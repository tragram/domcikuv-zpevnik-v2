import {
  AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { user } from "./auth.schema";

export const song = sqliteTable("song", {
  id: text("id").primaryKey(),
  currentVersionId: text("current_version_id").references(
    () => songVersion.id,
    { onDelete: "set null" },
  ),
  currentIllustrationId: text("current_illustration_id").references(
    () => songIllustration.id,
    { onDelete: "set null" },
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  hidden: integer("hidden", { mode: "boolean" }).default(false).notNull(),
  deleted: integer("deleted", { mode: "boolean" }).default(false).notNull(),
});

export type SongDataDB = typeof song.$inferSelect;

export const songVersion = sqliteTable("song_version", {
  id: text("id").primaryKey(),
  songId: text("song_id")
    .notNull()
    .references((): AnySQLiteColumn => song.id),

  // The lineage - which version was this edited from?
  parentId: text("parent_id").references((): AnySQLiteColumn => songVersion.id),

  // Status flow:
  // 'pending' (User suggestion) -> 'published' (Active) -> 'archived' (History) -> 'deleted'
  // 'rejected' (Closed without merging)
  status: text("status", {
    enum: ["pending", "published", "archived", "rejected", "draft", "deleted"],
  })
    .notNull()
    .default("pending"),

  title: text("title").notNull(),
  artist: text("artist").notNull(),
  key: text("key"),
  language: text("language").notNull(),
  capo: integer("capo"),
  range: text("range"),
  startMelody: text("start_melody"),
  tempo: text("tempo"),

  userId: text("user_id")
    .notNull()
    .references(() => user.id),

  approvedBy: text("approved_by").references(() => user.id),
  approvedAt: integer("approved_at", { mode: "timestamp" }),

  sourceId: text("source_id", {
    enum: ["editor", "pisnicky-akordy"],
  })
    .notNull()
    .default("editor"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),

  chordpro: text("chordpro").notNull(),
});

export type SongVersionDB = typeof songVersion.$inferSelect;

export const illustrationPrompt = sqliteTable("illustration_prompt", {
  id: text("id").primaryKey(),
  songId: text("song_id")
    .notNull()
    .references((): AnySQLiteColumn => song.id),
  summaryPromptVersion: text("prompt_version").notNull(),
  summaryModel: text("summary_model").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  deleted: integer("deleted", { mode: "boolean" }).default(false).notNull(),
});
export type IllustrationPromptDB = typeof illustrationPrompt.$inferSelect;

export const songIllustration = sqliteTable("song_illustration", {
  id: text("id").primaryKey(),
  songId: text("song_id")
    .notNull()
    .references((): AnySQLiteColumn => song.id),
  promptId: text("prompt_id")
    .references(() => illustrationPrompt.id)
    .notNull(),
  imageModel: text("image_model").notNull(),
  imageURL: text("image_url").notNull(),
  thumbnailURL: text("thumbnail_url").notNull(),
  // commonR2Key non null --> stored dynamically
  commonR2Key: text("common_r2_key"), // only the part that's common for imageURL and thumbnailURL
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  deleted: integer("deleted", { mode: "boolean" }).default(false).notNull(),
});

export type SongIllustrationDB = typeof songIllustration.$inferSelect;

// Relations for efficient querying
export const songRelations = relations(song, ({ one, many }) => ({
  // Get the current active illustration & version (only one per song)
  currentIllustration: one(songIllustration, {
    fields: [song.id],
    references: [songIllustration.songId],
  }),
  currentVersion: one(songVersion, {
    fields: [song.id],
    references: [songVersion.songId],
  }),
  // Get all illustrations & versions for this song
  illustration: many(songIllustration),
  version: many(songVersion),
}));

export const songIllustrationRelations = relations(
  songIllustration,
  ({ one }) => ({
    song: one(song, {
      fields: [songIllustration.songId],
      references: [song.id],
    }),
  }),
);

export const songVersionRelations = relations(songVersion, ({ one }) => ({
  song: one(song, {
    fields: [songVersion.songId],
    references: [song.id],
  }),
  user: one(user, {
    fields: [songVersion.userId],
    references: [user.id],
  }),
  approver: one(user, {
    fields: [songVersion.approvedBy],
    references: [user.id],
  }),
  parent: one(songVersion, {
    fields: [songVersion.parentId],
    references: [songVersion.id],
  }),
}));
export const illustrationPromptRelations = relations(
  illustrationPrompt,
  ({ one }) => ({
    song: one(song, {
      fields: [illustrationPrompt.songId],
      references: [song.id],
    }),
  }),
);
