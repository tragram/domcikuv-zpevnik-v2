import { AnySQLiteColumn, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";
import { song, songVersion } from "./song.schema";

// A favorites row is also the user's per-song "songbook entry": besides
// membership it carries their personal pin + key/capo overrides for that song.
export const userFavoriteSongs = sqliteTable("favorites", {
  id: integer("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  songId: text("song_id")
    .notNull()
    .references(() => song.id, { onDelete: "cascade" }),
  addedAt: integer("added_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),

  // The version this user sees in their songbook for this song. Survives
  // rejection / canonical changes. NULL = follow the song's current version.
  pinnedVersionId: text("pinned_version_id").references(
    (): AnySQLiteColumn => songVersion.id,
    { onDelete: "set null" },
  ),
  // Personal absolute sounding key as a pitch class (0..11, semitones from C)
  // changing. NULL = no key override, follow the song's original.
  keyIndex: integer("key_index"),
  // Personal absolute capo fret. NULL = use the song's original capo.
  capo: integer("capo"),
}, (table) => [index("favorites_user_song").on(table.userId, table.songId)]);

export type SongbookEntryDB = typeof userFavoriteSongs.$inferSelect;
