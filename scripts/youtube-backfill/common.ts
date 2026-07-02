/**
 * Plumbing for the YouTube-link / metadata backfill workflow:
 *   - bulk YouTube search by scraping the public results page (no Data API quota)
 *   - the on-disk review file (youtube-links.json)
 *
 * The remote D1 connection lives in ../shared/remote-db.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseYoutubeId, youtubeThumbnailUrl } from "../../src/lib/youtube";
import { db, sleep } from "../shared/remote-db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { db, parseYoutubeId, sleep };

// --- The review file ----------------------------------------------------------

export type Candidate = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailURL?: string;
};

// Each editable field (youtube / key / capo) tracks its own value plus a "saved"
// flag = "the user committed this". Unsaved fields track the DB (overwritten on
// every fetch); only saved fields are ever pushed. `db*` is the fresh DB snapshot
// from the last fetch, used as the baseline and as the default for unsaved fields.
export type BackfillItem = {
  songId: string;
  title: string;
  artist: string;
  /** Top YouTube auto-search result, if one was found. */
  candidate: Candidate | null;
  /** Whether auto-search already ran (so re-runs don't burn quota again). */
  searched: boolean;

  dbYoutubeId: string | null;
  dbKey: string | null;
  dbCapo: number | null;

  youtubeId: string | null;
  youtubeSaved: boolean;
  key: string | null;
  keySaved: boolean;
  capo: number | null;
  capoSaved: boolean;
};

export type BackfillFile = {
  generatedAt: string;
  items: BackfillItem[];
};

/** Fresh DB values for one song (current version). */
export type SongRow = {
  songId: string;
  title: string;
  artist: string;
  youtubeId: string | null;
  key: string | null;
  capo: number | null;
};

/**
 * Build the current item for a song by combining any prior review with fresh DB
 * values. Unsaved fields (and everything in an older file that predates the
 * per-field `saved` flags) come from the DB — only the fetched auto-search
 * candidate and `searched` flag are carried over. Once fields are saved via the
 * review UI (new format), saved ones are kept and unsaved ones tracked from DB.
 */
export function mergeItem(prev: Partial<BackfillItem> | undefined, db: SongRow): BackfillItem {
  const dbYoutubeId = db.youtubeId ?? null;
  const dbKey = db.key ?? null;
  const dbCapo = db.capo ?? null;

  const item: BackfillItem = {
    songId: db.songId,
    title: db.title,
    artist: db.artist,
    candidate: prev?.candidate ?? null,
    searched: prev?.searched ?? false,
    dbYoutubeId,
    dbKey,
    dbCapo,
    // Defaults: nothing saved, take from the DB. A song that already has a link
    // counts as "done" for the video.
    youtubeId: dbYoutubeId,
    youtubeSaved: !!dbYoutubeId,
    key: dbKey,
    keySaved: false,
    capo: dbCapo,
    capoSaved: false,
  };

  // New per-field format only: keep saved fields, refresh unsaved from the DB.
  if (prev && "youtubeSaved" in prev) {
    item.youtubeSaved = prev.youtubeSaved ?? false;
    item.youtubeId = item.youtubeSaved ? prev.youtubeId ?? null : dbYoutubeId;
    item.keySaved = prev.keySaved ?? false;
    item.key = item.keySaved ? prev.key ?? null : dbKey;
    item.capoSaved = prev.capoSaved ?? false;
    item.capo = item.capoSaved ? prev.capo ?? null : dbCapo;
  }

  return item;
}

export const DATA_PATH = path.resolve(__dirname, "youtube-links.json");

export function loadData(): BackfillFile | null {
  if (!fs.existsSync(DATA_PATH)) return null;
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")) as BackfillFile;
}

export function saveData(data: BackfillFile): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// --- YouTube search (page scrape, no Data API quota) --------------------------

/** Sentinel: searching can't continue right now (YouTube is IP-rate-limiting).
 *  The caller should save and resume later. */
export const QUOTA_EXCEEDED = "quota-exceeded" as const;

// The Data API's search.list costs 100 units against a 10k/day quota (~100
// searches/day), which is far too little for a full-catalogue backfill. Instead
// we scrape the public results page: no key, no quota. This is unofficial and
// can break if YouTube changes its markup.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  // Consent-bypass cookie: without it, EU IPs get redirected to
  // consent.youtube.com in a loop ("redirect count exceeded").
  Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+100",
};

type VideoRenderer = {
  videoId?: string;
  title?: { runs?: { text?: string }[] };
  ownerText?: { runs?: { text?: string }[] };
  longBylineText?: { runs?: { text?: string }[] };
};

/** Walk the ytInitialData tree for the first `videoRenderer` (the top result). */
function firstVideoRenderer(root: unknown): VideoRenderer | null {
  const queue: unknown[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (obj.videoRenderer && typeof obj.videoRenderer === "object") {
      return obj.videoRenderer as VideoRenderer;
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}

export async function searchYoutube(
  query: string,
): Promise<Candidate | null | typeof QUOTA_EXCEEDED> {
  // sp=EgIQAQ%3D%3D restricts results to videos.
  const url =
    "https://www.youtube.com/results?sp=EgIQAQ%253D%253D&hl=en&gl=US&search_query=" +
    encodeURIComponent(query);

  let response: Response;
  try {
    response = await fetch(url, { headers: BROWSER_HEADERS });
  } catch {
    // Transient network error (incl. a consent redirect loop) — skip this song
    // rather than aborting the whole run.
    return null;
  }
  if (response.status === 429) return QUOTA_EXCEEDED; // IP rate-limited
  if (!response.ok) return null;

  const html = await response.text();
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
  if (!match) return null;

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const vr = firstVideoRenderer(data);
  if (!vr?.videoId) return null;
  return {
    id: vr.videoId,
    title: vr.title?.runs?.[0]?.text ?? "",
    channelTitle:
      vr.ownerText?.runs?.[0]?.text ?? vr.longBylineText?.runs?.[0]?.text ?? "",
    thumbnailURL: youtubeThumbnailUrl(vr.videoId),
  };
}
