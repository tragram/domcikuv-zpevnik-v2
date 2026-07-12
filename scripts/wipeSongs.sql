-- Wipes all song content (versions, illustrations, prompts, songs).
-- Children before parents; the self-referential parent_id is nulled first
-- because a bulk DELETE checks it row-by-row in unspecified order.
-- No PRAGMAs: D1 doesn't support toggling foreign_keys and doesn't need
-- deferral for this ordering.
UPDATE song_version SET parent_id = NULL;

DELETE FROM sync_session;
DELETE FROM favorites;
DELETE FROM song_illustration;
DELETE FROM illustration_prompt;
DELETE FROM song_version;
DELETE FROM song;
