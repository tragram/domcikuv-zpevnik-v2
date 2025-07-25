import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth.schema";

export const song = sqliteTable("song", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  key: text("key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  startMelody: text("start_melody"),
  language: text("language").notNull(),
  tempo: integer("tempo"),
  capo: integer("capo"),
  range: text("range"),
  chordproURL: text("chordproURL").notNull(),
  hidden: integer("hidden", { mode: "boolean" }).default(false).notNull(),
});

export type SongDataDB = typeof song.$inferSelect;

export const illustrationPrompt = sqliteTable("illustration_prompt", {
  id: text("id").primaryKey(),
  songId: text("song_id")
    .notNull()
    .references(() => song.id),
  summaryPromptId: text("prompt_id").notNull(),
  summaryModel: text("summary_model").notNull(),
  text: text("text").notNull(),
});
export type IllustrationPromptDB = typeof illustrationPrompt.$inferSelect;

export const songIllustration = sqliteTable(
  "song_illustration",
  {
    id: text("id").primaryKey(),
    songId: text("song_id")
      .notNull()
      .references(() => song.id),
    promptId: text("prompt_id").references(() => illustrationPrompt.id),
    // whether the illustration was generated directly from the lyrics or with a summary intermediate step
    sourceType: text("source_type", { enum: ["summary", "lyricsDirectly"] }).notNull(),
    imageModel: text("image_model").notNull(),
    imageURL: text("image_url").notNull(),
    thumbnailURL: text("thumbnail_url").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .default(sql`(current_timestamp)`)
      .notNull(),
  },
  // ensure either there's a prompt_id or it's generated directly from an image
  (table) => [
    check(
      "prompt_constraint",
      sql`(source_type = 'lyricsDirectly') OR (source_type = 'summary' AND prompt_id IS NOT NULL)`
    ),
  ]
);

// Create discriminated union types
export type SummaryBasedIllustration = typeof songIllustration.$inferSelect & {
  sourceType: "summary";
  promptId: string;
};

export type DirectIllustration = typeof songIllustration.$inferSelect & {
  sourceType: "lyricsDirectly";
  promptId: null;
};

export type SongIllustrationDB = SummaryBasedIllustration | DirectIllustration;

export const songVersion = sqliteTable("song_version", {
  id: text("id").primaryKey(),
  songId: text("song_id")
    .notNull()
    .references(() => song.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  chordproURL: text("chordproURL").notNull(),
  // verified if either made by a trusted user or manually by an admin
  // this should probably be a separate table but oh well
  verified: integer("verified", { mode: "boolean" }).default(true).notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  verifiedByUser: text("verified_by_user").references(() => user.id),
});

export type SongVersionDB = typeof songVersion.$inferInsert;

// Relations for efficient querying
export const songRelations = relations(song, ({ one, many }) => ({
  // Get the current active illustration (only one per song)
  currentIllustration: one(songIllustration, {
    fields: [song.id],
    references: [songIllustration.songId],
  }),
  // Get all illustrations for this song
  illustrations: many(songIllustration),
  // Get all changes for this song
  changes: many(songVersion),
}));

export const songIllustrationRelations = relations(
  songIllustration,
  ({ one }) => ({
    song: one(song, {
      fields: [songIllustration.songId],
      references: [song.id],
    }),
  })
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
}));
