// Minimal pre-feature database for exercising the real additive migration.
export const versionHistoryFixture = `
CREATE TABLE user (
 id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
 email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL, nickname TEXT, is_trusted INTEGER DEFAULT 0 NOT NULL,
 is_admin INTEGER DEFAULT 0 NOT NULL, is_favorites_public INTEGER DEFAULT 0 NOT NULL,
 last_login INTEGER NOT NULL
);
CREATE TABLE song (
 id TEXT PRIMARY KEY NOT NULL, current_version_id TEXT REFERENCES song_version(id),
 current_illustration_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 deleted INTEGER DEFAULT 0 NOT NULL
);
CREATE TABLE song_import (
 id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL,
 source_id TEXT NOT NULL, originalContent TEXT NOT NULL, url TEXT NOT NULL,
 created_at INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES user(id)
);
CREATE TABLE song_version (
 id TEXT PRIMARY KEY NOT NULL, song_id TEXT NOT NULL REFERENCES song(id),
 parent_id TEXT REFERENCES song_version(id), import_id TEXT REFERENCES song_import(id),
 status TEXT DEFAULT 'pending' NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL,
 key TEXT, language TEXT, capo INTEGER, range TEXT, start_melody TEXT, tempo TEXT,
 youtube_id TEXT, user_id TEXT NOT NULL REFERENCES user(id), approved_by TEXT REFERENCES user(id),
 approved_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, chordpro TEXT NOT NULL
);
CREATE TABLE favorites (
 id INTEGER PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES user(id),
 song_id TEXT NOT NULL REFERENCES song(id), added_at INTEGER NOT NULL,
 pinned_version_id TEXT REFERENCES song_version(id), key_index INTEGER, capo INTEGER
);
`;

export const songIllustrationFixture = `
CREATE TABLE song_illustration (
 id TEXT PRIMARY KEY NOT NULL, song_id TEXT NOT NULL REFERENCES song(id), prompt_id TEXT NOT NULL,
 image_model TEXT NOT NULL, image_url TEXT NOT NULL, thumbnail_url TEXT NOT NULL,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER DEFAULT 0 NOT NULL
);
`;
