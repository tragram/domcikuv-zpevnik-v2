import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";
import { song, songIllustration, songVersion } from "./song.schema";
import { relations } from "drizzle-orm";

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
});

export const songRelations = relations(song, ({ one, many }) => ({
  currentIllustration: one(songIllustration, {
    fields: [song.currentIllustrationId],
    references: [songIllustration.id],
  }),
  currentVersion: one(songVersion, {
    fields: [song.currentVersionId],
    references: [songVersion.id],
  }),
  illustration: many(songIllustration),
  version: many(songVersion),

  // ADD THIS: Relation to favorites
  favorites: many(userFavoriteSongs),
}));
