import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";
import { song } from "./song.schema";

export const syncSessionTable = sqliteTable("syncSession", {
  id: integer("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  masterId: text("master_id").notNull(), // nickname ~ feed URL
  songId: text("song_id")
    .notNull()
    .references(() => song.id, { onDelete: "no action" }),
});
