-- One available raw copy per source URL and song. The trigger is atomic with
-- insertion, so concurrent fetches cannot both create a copy after reading none.
CREATE TRIGGER song_version_unique_import_insert BEFORE INSERT ON song_version
WHEN NEW.import_id IS NOT NULL AND NEW.status != 'deleted'
BEGIN
 SELECT RAISE(ABORT, 'Source already imported') WHERE EXISTS (
  SELECT 1 FROM song_version v
  JOIN song_import existing ON existing.id=v.import_id
  JOIN song_import incoming ON incoming.id=NEW.import_id
  WHERE v.song_id=NEW.song_id AND v.status != 'deleted'
   AND existing.source_id=incoming.source_id AND existing.url=incoming.url
 );
END;
--> statement-breakpoint
CREATE TRIGGER song_version_unique_import_update BEFORE UPDATE OF import_id,song_id,status ON song_version
WHEN NEW.import_id IS NOT NULL AND NEW.status != 'deleted'
BEGIN
 SELECT RAISE(ABORT, 'Source already imported') WHERE EXISTS (
  SELECT 1 FROM song_version v
  JOIN song_import existing ON existing.id=v.import_id
  JOIN song_import incoming ON incoming.id=NEW.import_id
  WHERE v.id!=NEW.id AND v.song_id=NEW.song_id AND v.status != 'deleted'
   AND existing.source_id=incoming.source_id AND existing.url=incoming.url
 );
END;
