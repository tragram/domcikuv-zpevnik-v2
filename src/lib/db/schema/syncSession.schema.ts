import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

export const syncSessionTable = sqliteTable("syncSession", {
  id: integer("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  masterId: text("master_id").notNull(), // nickname ~ feed URL
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});
