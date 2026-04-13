import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";
import { song, songVersion } from "./song.schema";

export const syncSession = sqliteTable("sync_session", {
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
  versionId: text("version_id").references(() => songVersion.id, {
    onDelete: "no action",
  }),
});
