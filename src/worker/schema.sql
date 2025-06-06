DROP TABLE IF EXISTS songbook_songs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS songbooks;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP VIEW IF EXISTS user_songbooks_summary;
DROP VIEW IF EXISTS active_sessions;

-- Users table with improved constraints and indexing
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL, 
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), -- Unix timestamp for D1 compatibility
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    is_admin BOOLEAN NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    avatar TEXT,
    last_login_at INTEGER,
    is_favorites_public BOOLEAN NOT NULL DEFAULT 0,
    
    -- Constraints
    CHECK (length(email) >= 3 AND length(email) <= 254),
    CHECK (length(nickname) >= 1 AND length(nickname) <= 100),
    CHECK (password_hash != ''),
    CHECK (is_admin IN (0, 1)),
    CHECK (is_verified IN (0, 1)),
    CHECK (is_favorites_public IN (0, 1))
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);

CREATE TABLE user_favorites (
    user_id INTEGER NOT NULL,
    song_id TEXT NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Songbooks table
-- CREATE TABLE songbooks (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     user_id INTEGER NOT NULL,
--     title TEXT NOT NULL DEFAULT 'Untitled Songbook',
--     description TEXT,
--     is_public BOOLEAN NOT NULL DEFAULT 0,
--     created_at INTEGER NOT NULL DEFAULT (unixepoch()),
--     updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
--     -- Foreign key constraints
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
--     -- Constraints
--     CHECK (length(title) >= 1 AND length(title) <= 200),
--     CHECK (is_public IN (0, 1))
-- );

-- -- Indexes for songbooks table
-- CREATE INDEX idx_songbooks_user_id ON songbooks(user_id);
-- CREATE INDEX idx_songbooks_public ON songbooks(is_public);
-- CREATE INDEX idx_songbooks_created_at ON songbooks(created_at);

-- -- Junction table for songbook-song relationships
-- CREATE TABLE songbook_songs (
--     songbook_id INTEGER NOT NULL,
--     song_id INTEGER NOT NULL,
--     added_at INTEGER NOT NULL DEFAULT (unixepoch()),
--     added_by_user_id INTEGER NOT NULL,
    
--     -- Composite primary key
--     PRIMARY KEY (songbook_id, song_id),
    
--     -- Foreign key constraints
--     FOREIGN KEY (songbook_id) REFERENCES songbooks(id) ON DELETE CASCADE ON UPDATE CASCADE,
--     FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
--     -- Note: Uncomment below if you have a songs table
--     -- FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE ON UPDATE CASCADE
-- );

-- -- Indexes for songbook_songs table
-- CREATE INDEX idx_songbook_songs_songbook_id ON songbook_songs(songbook_id);
-- CREATE INDEX idx_songbook_songs_song_id ON songbook_songs(song_id);
-- CREATE INDEX idx_songbook_songs_added_at ON songbook_songs(added_at);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = unixepoch() WHERE id = NEW.id;
    END;

-- CREATE TRIGGER update_songbooks_timestamp 
--     AFTER UPDATE ON songbooks
--     BEGIN
--         UPDATE songbooks SET updated_at = unixepoch() WHERE id = NEW.id;
--     END;

-- Sample data (commented out - uncomment to use)

INSERT OR IGNORE INTO users (id, nickname, email, password_hash, is_admin, is_verified) 
VALUES (
    1,
    'Demo User',
    'd@x.com',
    '09e97dfc19d1894416d31971c9a3a63d:ebd49c0f3d16cc512684c2f0893e9a476e7b56ab861bb4965ddf44d9da3a386b',
    0,
    1
);

-- INSERT OR IGNORE INTO songbooks (user_id, title, is_public)
-- VALUES (1, 'My First Songbook', 0);


-- Views for common queries
-- CREATE VIEW user_songbooks_summary AS
-- SELECT 
--     u.id as user_id,
--     u.name as user_name,
--     u.email,
--     COUNT(s.id) as songbook_count,
--     COUNT(CASE WHEN s.is_public = 1 THEN 1 END) as public_songbook_count
-- FROM users u
-- LEFT JOIN songbooks s ON u.id = s.user_id
-- GROUP BY u.id, u.name, u.email;


CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);