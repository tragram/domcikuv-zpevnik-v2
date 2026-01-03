import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";
import { song } from "./song.schema";

export const syncSessionTable = sqliteTable("syncSession", {
  id: integer("id").primaryKey(),
  masterId: text("master_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  songId: text("song_id")
    .notNull()
    .references(() => song.id, { onDelete: "no action" }),
});
