/**
 * Backs up (read-only, locally) the capos currently stored on every song's
 * current version, plus a snapshot of the target user's favorites rows
 * (capo / keyIndex / pin) so `apply.ts` can be rolled back if needed.
 *
 *   pnpm run capo:backup
 *   pnpm run capo:backup -- --email=someone@example.com
 *
 * Writes capo-backup.json next to this script.
 */
import fs from "node:fs";

import { eq } from "drizzle-orm";
import { song, songVersion, user, userFavoriteSongs } from "../../src/lib/db/schema";
import { db } from "../shared/remote-db";
import { BACKUP_PATH, targetEmail } from "./config";

async function main() {
  const email = targetEmail();
  console.log("Backing up current song capos + favorites from the remote DB...");

  // Every song's current-version capo (and key, for reference).
  const songCapos = await db
    .select({ songId: song.id, capo: songVersion.capo, key: songVersion.key })
    .from(song)
    .innerJoin(songVersion, eq(song.currentVersionId, songVersion.id))
    .where(eq(song.deleted, false));

  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email));
  const u = users[0];
  if (!u) {
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }

  const favorites = await db
    .select({
      id: userFavoriteSongs.id,
      songId: userFavoriteSongs.songId,
      capo: userFavoriteSongs.capo,
      keyIndex: userFavoriteSongs.keyIndex,
      pinnedVersionId: userFavoriteSongs.pinnedVersionId,
    })
    .from(userFavoriteSongs)
    .where(eq(userFavoriteSongs.userId, u.id));

  const backup = {
    generatedAt: new Date().toISOString(),
    email,
    userId: u.id,
    songCapos,
    favorites,
  };
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), "utf-8");

  console.log(
    `\n✅ Backed up ${songCapos.length} song capos and ${favorites.length} favorites for ${email}.`,
  );
  console.log(`   -> ${BACKUP_PATH}`);
  console.log("\nNext: `pnpm run capo:apply` (dry run), then `-- --apply`.");
}

main().catch((e) => {
  console.error("backup failed:", e);
  process.exit(1);
});
