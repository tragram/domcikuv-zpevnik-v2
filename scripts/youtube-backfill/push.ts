/**
 * Step 3 — write reviewed metadata back to the REMOTE DB.
 *
 * Only saved fields are considered, and only those that actually differ from the
 * current DB value are written to the song's CURRENT version row:
 *   - youtube_id
 *   - capo
 *   - key — and when the key changes the inline chords (and range / start melody)
 *     are TRANSPOSED to the new key, using the same logic as the editor.
 *
 * Dry-run by default; pass --apply to actually write.
 *
 *   pnpm run yt:push            # preview what would change
 *   pnpm run yt:push -- --apply # write to the remote DB
 */
import { and, eq, inArray } from "drizzle-orm";
import { song, songVersion } from "../../src/lib/db/schema";
import { db, loadData, parseYoutubeId } from "./common";
import {
  guessKeyFromChords,
  keyStepsBetween,
  transposeChords,
  transposeRangeValue,
  transposeStartMelodyValue,
} from "../shared/transpose";

type FieldSet = {
  youtubeId?: string | null;
  key?: string | null;
  capo?: number | null;
  chordpro?: string;
  range?: string | null;
  startMelody?: string | null;
};

const show = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "∅" : String(v);

async function main() {
  const apply = process.argv.includes("--apply");
  const data = loadData();
  if (!data) {
    console.error("No youtube-links.json found. Run `pnpm run yt:fetch` first.");
    process.exit(1);
  }

  // Only songs with at least one saved field are candidates.
  const candidates = data.items.filter(
    (i) => i.youtubeSaved || i.keySaved || i.capoSaved,
  );
  if (candidates.length === 0) {
    console.log("No saved fields to push. Nothing to do.");
    return;
  }

  // Fresh current-version values (incl. chordpro) for the candidate songs, so we
  // diff/transpose against live data and never write to a stale version.
  const songIds = candidates.map((c) => c.songId);
  // D1 rejects statements with too many bound parameters, so fetch in batches.
  const BATCH_SIZE = 100;
  const rows: {
    songId: string;
    versionId: string | null;
    youtubeId: string | null;
    key: string | null;
    capo: number | null;
    range: string | null;
    startMelody: string | null;
    chordpro: string;
  }[] = [];
  for (let i = 0; i < songIds.length; i += BATCH_SIZE) {
    const batch = songIds.slice(i, i + BATCH_SIZE);
    const batchRows = await db
      .select({
        songId: song.id,
        versionId: songVersion.id,
        youtubeId: songVersion.youtubeId,
        key: songVersion.key,
        capo: songVersion.capo,
        range: songVersion.range,
        startMelody: songVersion.startMelody,
        chordpro: songVersion.chordpro,
      })
      .from(song)
      .innerJoin(
        songVersion,
        and(
          eq(songVersion.songId, song.id),
          eq(songVersion.status, "published"),
        ),
      )
      .where(inArray(song.id, batch));
    rows.push(...batchRows);
  }
  const dbBySong = new Map(rows.map((r) => [r.songId, r]));

  const changes: {
    songId: string;
    versionId: string;
    title: string;
    artist: string;
    set: FieldSet;
    summary: string[];
  }[] = [];
  let invalidYt = 0;
  let missing = 0;

  for (const item of candidates) {
    const cur = dbBySong.get(item.songId);
    if (!cur || !cur.versionId) {
      missing++;
      continue;
    }
    const set: FieldSet = {};
    const summary: string[] = [];

    if (item.youtubeSaved) {
      const target = item.youtubeId ? parseYoutubeId(item.youtubeId) : null;
      if (item.youtubeId && !target) {
        invalidYt++;
      } else if (target !== (cur.youtubeId ?? null)) {
        set.youtubeId = target;
        summary.push(`youtube ${show(cur.youtubeId)}→${show(target)}`);
      }
    }

    if (item.capoSaved && (item.capo ?? null) !== (cur.capo ?? null)) {
      set.capo = item.capo ?? null;
      summary.push(`capo ${show(cur.capo)}→${show(item.capo)}`);
    }

    if (item.keySaved && (item.key ?? null) !== (cur.key ?? null)) {
      const target = item.key ?? null;
      set.key = target;
      summary.push(`key ${show(cur.key)}→${show(target)}`);

      if (target) {
        // Transpose the chords to the new key. Source key = current DB key, or a
        // best-effort guess from the first chord.
        const source = cur.key || guessKeyFromChords(cur.chordpro);
        if (!source) {
          summary.push("⚠ no source key — chords NOT transposed");
        } else {
          const steps = keyStepsBetween(source, target);
          if (steps === null) {
            summary.push("⚠ unparseable key — chords NOT transposed");
          } else if (steps !== 0) {
            set.chordpro = transposeChords(cur.chordpro, steps);
            if (cur.range) set.range = transposeRangeValue(cur.range, steps);
            if (cur.startMelody)
              set.startMelody = transposeStartMelodyValue(cur.startMelody, steps);
            summary.push(`transpose ${steps > 0 ? "+" : ""}${steps} st`);
          }
        }
      }
    }

    if (Object.keys(set).length > 0) {
      changes.push({
        songId: item.songId,
        versionId: cur.versionId,
        title: item.title,
        artist: item.artist,
        set,
        summary,
      });
    }
  }

  console.log(`Candidates (saved):  ${candidates.length}`);
  if (missing) console.log(`No current version:  ${missing}`);
  if (invalidYt) console.log(`Invalid YouTube ids: ${invalidYt}`);
  console.log(`Songs to update:     ${changes.length}`);

  if (changes.length === 0) {
    console.log("\nNothing to write.");
    return;
  }

  if (!apply) {
    console.log("\nPreview (first 40):");
    for (const ch of changes.slice(0, 40)) {
      console.log(`  ${ch.artist} — ${ch.title}: ${ch.summary.join(", ")}`);
    }
    if (changes.length > 40) console.log(`  ...and ${changes.length - 40} more`);
    console.log("\nDry run only. Re-run with `-- --apply` to write to the REMOTE DB.");
    return;
  }

  let done = 0;
  for (const ch of changes) {
    await db.update(songVersion).set(ch.set).where(eq(songVersion.id, ch.versionId));
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${changes.length}...`);
  }

  console.log(`\n✅ Updated ${done} songs on the remote DB.`);
  console.log(
    "\nRemember to click 'Reset DB Version' in the Admin Dashboard so cached " +
      "clients pick up the changes.",
  );
}

main().catch((e) => {
  console.error("push failed:", e);
  process.exit(1);
});
