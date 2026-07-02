/**
 * Step 1 — fetch all non-external songs (i.e. not imported from an external
 * source like pisnicky-akordy/cifraclub/zpevnik-skorepova) from the REMOTE DB
 * and auto-search a YouTube video for each one that doesn't already have a
 * link. Results are written to youtube-links.json for manual review (see
 * server.ts).
 *
 * Read-only against the DB. Safe to re-run: existing reviews are preserved and
 * only not-yet-searched songs are looked up, so an interrupted run (e.g. YouTube
 * starts returning 429s) just continues where it left off next time. Search is
 * done by scraping the public results page — no Data API key or quota.
 *
 *   pnpm run yt:fetch
 */
import { and, eq, isNull } from "drizzle-orm";
import { song, songVersion } from "../../src/lib/db/schema";
import {
  BackfillItem,
  db,
  loadData,
  mergeItem,
  QUOTA_EXCEEDED,
  saveData,
  searchYoutube,
  sleep,
} from "./common";

// Politeness delay between scraped searches (no API quota, but don't hammer
// YouTube from one IP or it starts returning 429s).
const SEARCH_DELAY_MS = 500;
const SAVE_EVERY = 10;

async function main() {
  const existing = loadData();
  const reviewed = new Map(existing?.items.map((i) => [i.songId, i]) ?? []);

  console.log("Fetching current songs from the remote DB...");
  const songs = await db
    .select({
      songId: song.id,
      title: songVersion.title,
      artist: songVersion.artist,
      youtubeId: songVersion.youtubeId,
      key: songVersion.key,
      capo: songVersion.capo,
    })
    .from(song)
    .innerJoin(songVersion, eq(song.currentVersionId, songVersion.id))
    .where(and(eq(song.deleted, false), isNull(songVersion.importId)));
  console.log(`Found ${songs.length} songs.`);

  // Migrate the WHOLE catalogue up front (combine any prior review with fresh DB
  // values: saved fields kept, unsaved overwritten by DB, old files migrated) and
  // persist immediately — so the file on disk is always complete. Searching then
  // only fills in candidates in place, meaning an interrupt at any point (incl.
  // during a rate-limit wait) leaves a full, valid file with candidates so far.
  const items: BackfillItem[] = songs.map((s) =>
    mergeItem(reviewed.get(s.songId), {
      songId: s.songId,
      title: s.title,
      artist: s.artist,
      youtubeId: s.youtubeId ?? null,
      key: s.key ?? null,
      capo: s.capo ?? null,
    }),
  );

  const persist = () =>
    saveData({
      generatedAt: existing?.generatedAt ?? new Date().toISOString(),
      items,
    });

  persist(); // full migrated set on disk before any network call

  let searched = 0;
  let found = 0;
  let quotaHit = false;

  for (const item of items) {
    // Search only when the video is unreviewed, has no DB link, and hasn't been
    // searched before — so an interrupted run resumes on the remainder next time.
    if (!item.youtubeSaved && !item.dbYoutubeId && !item.searched) {
      const result = await searchYoutube(`${item.artist} ${item.title}`.trim());
      if (result === QUOTA_EXCEEDED) {
        quotaHit = true;
        console.warn(
          "\n⚠️  YouTube is rate-limiting this IP (429) — stopping search. " +
            "Wait a bit, then re-run `pnpm run yt:fetch` to continue where it left off.\n",
        );
        break;
      }
      item.searched = true; // mutates the object already in `items`
      if (result) {
        item.candidate = result; // suggestion shown in the UI (not saved yet)
        found++;
      }
      searched++;
      if (searched % SAVE_EVERY === 0) {
        persist();
        console.log(`  searched ${searched} (found ${found})...`);
      }
      await sleep(SEARCH_DELAY_MS);
    }
  }

  persist();

  // "pending" = video not yet saved (awaiting review); "toSearch" = not yet hit
  // by the YouTube API, i.e. the work a re-run will pick up.
  const pending = items.filter((i) => !i.youtubeSaved).length;
  const toSearch = items.filter(
    (i) => !i.youtubeSaved && !i.dbYoutubeId && !i.searched,
  ).length;
  console.log("\n✅ Done.");
  console.log(`   Songs:            ${items.length}`);
  console.log(`   Searched now:     ${searched} (candidates found: ${found})`);
  console.log(`   Still to search:  ${toSearch}`);
  console.log(`   Pending review:   ${pending}`);
  if (quotaHit) {
    console.log(
      `   ⚠️  Stopped early on quota — re-run to search the remaining ${toSearch}.`,
    );
  }
  console.log("\nNext: `pnpm run yt:review` to check the results in the browser.");
}

main().catch((e) => {
  console.error("fetch failed:", e);
  process.exit(1);
});
