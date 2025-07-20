import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { user } from "./auth.schema";

export const song = sqliteTable("song", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  key: text("key").notNull(),
  dateAdded: integer("date_added", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  dateModified: integer("date_modified", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  startMelody: text("start_melody"),
  language: text("language").notNull(),
  tempo: text("tempo"),
  capo: integer("capo"),
  range: text("range"),
  chordproURL: text("chordproURL").notNull(),
  // verified if either added by a trusted user or manually by an admin
  verified: integer("verified", { mode: "boolean" }).default(true).notNull(),
  // illustrationId: text("illustration_id").references(() => songIllustration.id),
});

export const songIllustration = sqliteTable("songIllustration", {
  id: text("id").primaryKey(),
  songId: text("song_id")
    .notNull()
    .references(() => song.id),
  promptId: text("prompt_id").notNull(),
  promptModel: text("prompt_model").notNull(),
  imageModel: text("image_model").notNull(),
  imageURL: text("image_url").notNull(),
  thumbnailURL: text("thumbnail_url").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const songChange = sqliteTable("songChange", {
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
});

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
  changes: many(songChange),
}));

export const songIllustrationRelations = relations(songIllustration, ({ one }) => ({
  song: one(song, {
    fields: [songIllustration.songId],
    references: [song.id],
  }),
}));

export const songChangeRelations = relations(songChange, ({ one }) => ({
  song: one(song, {
    fields: [songChange.songId],
    references: [song.id],
  }),
  user: one(user, {
    fields: [songChange.userId],
    references: [user.id],
  }),
}));