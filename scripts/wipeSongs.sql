PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys = on;

DELETE FROM song_illustration;
DELETE FROM illustration_prompt;
DELETE FROM song_version;
DELETE FROM song;

PRAGMA defer_foreign_keys = off;
PRAGMA foreign_keys=ON;