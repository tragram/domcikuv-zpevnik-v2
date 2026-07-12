/**
 * Copies each song's current capo into the target user's favorites row, so the
 * songbook locks in today's capos (e.g. before song-level capos get edited).
 *
 * Requires capo-backup.json to exist first (run `pnpm run capo:backup`).
 *
 *   pnpm run capo:apply                 # dry run — shows what would change
 *   pnpm run capo:apply -- --apply      # write to the remote DB
 *   pnpm run capo:apply -- --apply --overwrite   # also replace existing overrides
 *
 * By default a favorite that already has its own capo override is left alone;
 * pass --overwrite to force every favorite to match its song's current capo.
 */
import { and, eq, inArray } from "drizzle-orm";
import { song, songVersion, user, userFavoriteSongs } from "../../src/lib/db/schema";
import { db } from "../shared/remote-db";
import fs from "node:fs";
import { BACKUP_PATH, targetEmail } from "./config";

async function main() {
  const apply = process.argv.includes("--apply");
  const overwrite = process.argv.includes("--overwrite");
  const email = targetEmail();

  if (!fs.existsSync(BACKUP_PATH)) {
    console.error("No capo-backup.json found — run `pnpm run capo:backup` first.");
    process.exit(1);
  }

  const users = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  const u = users[0];
  if (!u) {
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }

  const favorites = await db
    .select({ id: userFavoriteSongs.id, songId: userFavoriteSongs.songId, capo: userFavoriteSongs.capo })
    .from(userFavoriteSongs)
    .where(eq(userFavoriteSongs.userId, u.id));

  if (favorites.length === 0) {
    console.log(`${email} has no favorites — nothing to do.`);
    return;
  }

  // Current song capos for just the favorited songs.
  const songIds = favorites.map((f) => f.songId);
  const songRows = await db
    .select({ songId: song.id, capo: songVersion.capo })
    .from(song)
    .innerJoin(
      songVersion,
      and(eq(songVersion.songId, song.id), eq(songVersion.status, "published")),
    )
    .where(inArray(song.id, songIds));
  const capoBySong = new Map(songRows.map((r) => [r.songId, r.capo]));

  const updates: { id: number; songId: string; from: number | null; to: number }[] = [];
  let alreadySame = 0;
  let keptOverride = 0;
  let noSongCapo = 0;

  for (const fav of favorites) {
    const target = capoBySong.get(fav.songId);
    if (target === null || target === undefined) {
      noSongCapo++; // song has no capo to copy
      continue;
    }
    if (fav.capo === target) {
      alreadySame++;
      continue;
    }
    if (fav.capo !== null && fav.capo !== undefined && !overwrite) {
      keptOverride++; // user already set a capo here — leave it unless --overwrite
      continue;
    }
    updates.push({ id: fav.id, songId: fav.songId, from: fav.capo ?? null, to: target });
  }

  console.log(`User:                 ${email}`);
  console.log(`Favorites:            ${favorites.length}`);
  console.log(`Already matching:     ${alreadySame}`);
  console.log(`Song has no capo:     ${noSongCapo}`);
  console.log(`Existing override:    ${keptOverride}${overwrite ? "" : " (kept — use --overwrite to replace)"}`);
  console.log(`To set:               ${updates.length}`);

  if (updates.length === 0) {
    console.log("\nNothing to write.");
    return;
  }

  if (!apply) {
    console.log("\nPreview (first 30):");
    for (const u2 of updates.slice(0, 30)) {
      console.log(`  ${u2.songId}: capo ${u2.from ?? "∅"} -> ${u2.to}`);
    }
    if (updates.length > 30) console.log(`  ...and ${updates.length - 30} more`);
    console.log("\nDry run only. Re-run with `-- --apply` to write to the REMOTE DB.");
    return;
  }

  let done = 0;
  for (const upd of updates) {
    await db
      .update(userFavoriteSongs)
      .set({ capo: upd.to })
      .where(eq(userFavoriteSongs.id, upd.id));
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${updates.length}...`);
  }

  console.log(`\n✅ Set capo on ${done} favorites for ${email}.`);
}

main().catch((e) => {
  console.error("apply failed:", e);
  process.exit(1);
});
