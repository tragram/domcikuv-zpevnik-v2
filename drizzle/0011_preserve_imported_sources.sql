-- Imported sources are archived copies, not consumed local alternatives.
-- Reverse the consumed marker from earlier consolidations without changing
-- source content, destination content, official selection, or songbook pins.
UPDATE song_version
SET status = 'archived', merged_into_version_id = NULL,
    revision = revision + 1,
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE import_id IS NOT NULL AND merged_into_version_id IS NOT NULL
  AND status IN ('archived', 'deleted');
