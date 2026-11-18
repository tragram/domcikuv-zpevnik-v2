-- A merged source is history of the surviving version, not an archived
-- alternative. Keep its identity, merge link and snapshots for admin history.
UPDATE song_version
SET status = 'deleted', revision = revision + 1,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE merged_into_version_id IS NOT NULL AND status = 'archived';
