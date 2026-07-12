import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { SONG_SOURCES } from "src/lib/contracts/song-sources";
import { user } from "./auth.schema";

// The song's current version/illustration are DERIVED, not stored: the current
// version is the one with status = 'published' (at most one, enforced by a
// partial unique index) and the current illustration is the one flagged
// `isCurrent`. Pointer columns on `song` used to track these, but they created
// a circular FK and could silently drift (point at another song's version, at
// a stale row, or disagree with `status`).
export const song = sqliteTable("song", {
  id: text("id").primaryKey(),
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

export const songVersion = sqliteTable(
  "song_version",
  {
    id: text("id").primaryKey(),
    songId: text("song_id")
      .notNull()
      .references((): AnySQLiteColumn => song.id),

    // The internal lineage - which version was this edited from?
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => songVersion.id,
    ),
    // the external lineage
    importId: text("import_id").references(
      (): AnySQLiteColumn => songImport.id,
    ),

    // Status flow:
    // 'pending' (User suggestion) -> 'published' (Active) -> 'archived' (History) -> 'deleted'
    // 'rejected' (Closed without merging)
    // 'published' doubles as "this is the song's current version"; the partial
    // unique index below guarantees there is at most one per song.
    status: text("status", {
      enum: ["pending", "published", "archived", "rejected", "deleted"],
    })
      .notNull()
      .default("pending"),

    title: text("title").notNull(),
    artist: text("artist").notNull(),
    key: text("key"),
    language: text("language"),
    capo: integer("capo"),
    range: text("range"),
    startMelody: text("start_melody"),
    tempo: text("tempo"),
    // Canonical 11-char YouTube video id (no URL), or null. See src/lib/youtube.ts.
    youtubeId: text("youtube_id"),

    userId: text("user_id")
      .notNull()
      .references(() => user.id),

    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: integer("approved_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),

    chordpro: text("chordpro").notNull(),
  },
  (table) => [
    uniqueIndex("song_version_published_unique")
      .on(table.songId)
      .where(sql`"status" = 'published'`),
    // Serves "current version of song X" joins; the partial index above can't
    // (SQLite won't match it against a bound status parameter).
    index("song_version_song_id_idx").on(table.songId, table.status),
  ],
);

export type SongVersionDB = typeof songVersion.$inferSelect;

export const songImport = sqliteTable("song_import", {
  id: text("id").primaryKey(),
  title: text().notNull(),
  artist: text().notNull(),
  sourceId: text("source_id", {
    enum: SONG_SOURCES,
  }).notNull(),
  originalContent: text().notNull(),
  url: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export type SongImportDB = typeof songImport.$inferSelect;

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

export const songIllustration = sqliteTable(
  "song_illustration",
  {
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
    // The song's displayed illustration (at most one per song, see the partial
    // unique index below).
    isCurrent: integer("is_current", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    deleted: integer("deleted", { mode: "boolean" }).default(false).notNull(),
  },
  (table) => [
    uniqueIndex("song_illustration_current_unique")
      .on(table.songId)
      .where(sql`"is_current" = 1`),
    index("song_illustration_song_id_idx").on(table.songId),
  ],
);

export type SongIllustrationDB = typeof songIllustration.$inferSelect;

