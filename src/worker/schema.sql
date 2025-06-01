-- Improved CloudFlare D1 Database Schema
-- =====================================

-- Drop tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS songbook_songs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS songbooks;
DROP TABLE IF EXISTS users;
DROP VIEW IF EXISTS user_songbooks_summary;
DROP VIEW IF EXISTS active_sessions;

-- Users table with improved constraints and indexing
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL, -- More descriptive name
    created_at INTEGER NOT NULL DEFAULT (unixepoch()), -- Unix timestamp for D1 compatibility
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    is_admin BOOLEAN NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    avatar_url TEXT,
    last_login_at INTEGER,
    
    -- Constraints
    CHECK (length(email) >= 3 AND length(email) <= 254),
    CHECK (length(name) >= 1 AND length(name) <= 100),
    CHECK (password_hash != ''),
    CHECK (is_admin IN (0, 1)),
    CHECK (is_verified IN (0, 1))
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- Songbooks table with better naming and constraints
CREATE TABLE songbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Songbook',
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Constraints
    CHECK (length(title) >= 1 AND length(title) <= 200),
    CHECK (is_public IN (0, 1))
);

-- Indexes for songbooks table
CREATE INDEX idx_songbooks_user_id ON songbooks(user_id);
CREATE INDEX idx_songbooks_public ON songbooks(is_public);
CREATE INDEX idx_songbooks_created_at ON songbooks(created_at);

-- Junction table for songbook-song relationships
CREATE TABLE songbook_songs (
    songbook_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (unixepoch()),
    added_by_user_id INTEGER NOT NULL,
    
    -- Composite primary key
    PRIMARY KEY (songbook_id, song_id),
    
    -- Foreign key constraints
    FOREIGN KEY (songbook_id) REFERENCES songbooks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
    -- Note: Uncomment below if you have a songs table
    -- FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for songbook_songs table
CREATE INDEX idx_songbook_songs_songbook_id ON songbook_songs(songbook_id);
CREATE INDEX idx_songbook_songs_song_id ON songbook_songs(song_id);
CREATE INDEX idx_songbook_songs_added_at ON songbook_songs(added_at);

-- User sessions table with improved security and naming
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- Store hashed tokens for security
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Constraints
    CHECK (expires_at > created_at),
    CHECK (is_active IN (0, 1))
);

-- Indexes for user_sessions table
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = unixepoch() WHERE id = NEW.id;
    END;

CREATE TRIGGER update_songbooks_timestamp 
    AFTER UPDATE ON songbooks
    BEGIN
        UPDATE songbooks SET updated_at = unixepoch() WHERE id = NEW.id;
    END;

-- Sample data (commented out - uncomment to use)

INSERT OR IGNORE INTO users (id, name, email, password_hash, is_admin, is_verified) 
VALUES (
    1,
    'Demo User',
    'demo@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    0,
    1
);

INSERT OR IGNORE INTO songbooks (user_id, title, is_public)
VALUES (1, 'My First Songbook', 0);


-- Views for common queries
CREATE VIEW user_songbooks_summary AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email,
    COUNT(s.id) as songbook_count,
    COUNT(CASE WHEN s.is_public = 1 THEN 1 END) as public_songbook_count
FROM users u
LEFT JOIN songbooks s ON u.id = s.user_id
GROUP BY u.id, u.name, u.email;

CREATE VIEW active_sessions AS
SELECT 
    us.id,
    us.user_id,
    u.name as user_name,
    u.email,
    us.created_at,
    us.expires_at,
    us.ip_address
FROM user_sessions us
JOIN users u ON us.user_id = u.id
WHERE us.is_active = 1 AND us.expires_at > unixepoch();