import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";
import { song } from "./song.schema";

export const userFavoriteSongs = sqliteTable("favorites", {
  id: integer("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  songId: text("song_id")
    .notNull()
    .references(() => song.id),
  addedAt: integer("added_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});
