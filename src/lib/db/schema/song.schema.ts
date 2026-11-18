import {
  AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { SONG_SOURCES } from "src/lib/contracts/song-sources";
import { user } from "./auth.schema";
import { songContentFields } from "src/lib/song-content";
export { songContentFields } from "src/lib/song-content";

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

  // The internal lineage - which version was this edited from?
  parentId: text("parent_id").references((): AnySQLiteColumn => songVersion.id),
  // the external lineage
  importId: text("import_id").references((): AnySQLiteColumn => songImport.id),
  label: text("label"),
  description: text("description"),
  // Internal optimistic concurrency token, never a public version name.
  revision: integer("revision").notNull().default(1),
  editedBy: text("edited_by").references(() => user.id),
  // Set when this version's content was applied to another version, either by
  // approving a revision suggestion or by an admin merge. Keep the source and
  // its history, but prevent it from being restored as a separate live version.
  // An ordinary archived version leaves this null and can still be restored.
  // The destination ID records which version absorbed the submitted content.
  mergedIntoVersionId: text("merged_into_version_id").references(
    (): AnySQLiteColumn => songVersion.id,
  ),

  // Status flow:
  // 'pending' (User suggestion) -> 'published' (Active) -> 'archived' (History) -> 'deleted'
  // 'rejected' (Closed without merging)
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
});

export const songSubmission = sqliteTable("song_submission", {
  versionId: text("version_id")
    .primaryKey()
    .notNull()
    .references(() => songVersion.id),
  // Pending copies can either correct their parent or become an alternative.
  // Parentage alone cannot tell approval which operation the author requested.
  submissionIntent: text("submission_intent", {
    enum: ["update-parent", "new-version"],
  }),
  baseRevision: integer("base_revision"),
  // Official selection observed at submission time, not the correction target.
  // The target is parentId; this guards publication choices if official changes.
  baseOfficialVersionId: text("base_official_version_id"),
  archivePreviousOnPublish: integer("archive_previous_on_publish", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  makeOfficialOnPublish: integer("make_official_on_publish", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
});
export type SongSubmissionDB = typeof songSubmission.$inferSelect;
export type SongVersionWithSubmission = SongVersionDB &
  Partial<Omit<SongSubmissionDB, "versionId">>;

export type SongVersionDB = typeof songVersion.$inferSelect;

export type SongRevisionContent = Pick<
  SongVersionDB,
  (typeof songContentFields)[number]
>;

// Filled by database triggers, including imports and maintenance scripts.
export const songRevision = sqliteTable(
  "song_revision",
  {
    id: text("id").primaryKey().notNull(),
    versionId: text("version_id")
      .notNull()
      .references(() => songVersion.id),
    number: integer("number").notNull(),
    content: text("content", { mode: "json" })
      .$type<SongRevisionContent>()
      .notNull(),
    status: text("status").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    approvedBy: text("approved_by").references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("song_revision_version_number").on(
      table.versionId,
      table.number,
    ),
  ],
);

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
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  deleted: integer("deleted", { mode: "boolean" }).default(false).notNull(),
});

export type SongIllustrationDB = typeof songIllustration.$inferSelect;
