CREATE TABLE `song_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`number` integer NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`user_id` text NOT NULL,
	`approved_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `song_version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `song_revision_version_number` ON `song_revision` (`version_id`,`number`);--> statement-breakpoint
ALTER TABLE `song_version` ADD `label` text;--> statement-breakpoint
ALTER TABLE `song_version` ADD `description` text;--> statement-breakpoint
ALTER TABLE `song_version` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `song_version` ADD `edited_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `song_version` ADD `submission_intent` text;--> statement-breakpoint
ALTER TABLE `song_version` ADD `base_revision` integer;--> statement-breakpoint
ALTER TABLE `song_version` ADD `base_official_version_id` text;--> statement-breakpoint
ALTER TABLE `song_version` ADD `archive_previous_on_publish` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `song_version` ADD `make_official_on_publish` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `song_version` ADD `merged_into_version_id` text REFERENCES song_version(id);
--> statement-breakpoint
-- One honest baseline per legacy row. Earlier overwritten content cannot be reconstructed.
INSERT INTO song_revision (id, version_id, number, content, status, user_id, approved_by, created_at)
SELECT id || ':1', id, 1,
 json_object('title', title, 'artist', artist, 'chordpro', chordpro, 'key', key,
 'language', language, 'capo', capo, 'range', range, 'startMelody', start_melody,
 'tempo', tempo, 'youtubeId', youtube_id, 'label', label, 'description', description),
 status, user_id, approved_by, updated_at FROM song_version;
--> statement-breakpoint
-- A stale writer aborts the entire D1 batch, including coupled lifecycle/pin writes.
CREATE TRIGGER song_version_revision_guard BEFORE UPDATE ON song_version
WHEN NEW.revision != OLD.revision + 1
BEGIN
 SELECT RAISE(ABORT, 'VERSION_CONFLICT');
END;
--> statement-breakpoint
CREATE TRIGGER song_version_initial_revision AFTER INSERT ON song_version
BEGIN
 INSERT INTO song_revision (id, version_id, number, content, status, user_id, approved_by, created_at)
 VALUES (NEW.id || ':' || NEW.revision, NEW.id, NEW.revision,
 json_object('title', NEW.title, 'artist', NEW.artist, 'chordpro', NEW.chordpro, 'key', NEW.key,
 'language', NEW.language, 'capo', NEW.capo, 'range', NEW.range, 'startMelody', NEW.start_melody,
 'tempo', NEW.tempo, 'youtubeId', NEW.youtube_id, 'label', NEW.label, 'description', NEW.description),
 NEW.status, coalesce(NEW.edited_by, NEW.user_id), NEW.approved_by, NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER song_version_saved_revision AFTER UPDATE ON song_version
BEGIN
 INSERT INTO song_revision (id, version_id, number, content, status, user_id, approved_by, created_at)
 VALUES (NEW.id || ':' || NEW.revision, NEW.id, NEW.revision,
 json_object('title', NEW.title, 'artist', NEW.artist, 'chordpro', NEW.chordpro, 'key', NEW.key,
 'language', NEW.language, 'capo', NEW.capo, 'range', NEW.range, 'startMelody', NEW.start_melody,
 'tempo', NEW.tempo, 'youtubeId', NEW.youtube_id, 'label', NEW.label, 'description', NEW.description),
 NEW.status, coalesce(NEW.edited_by, NEW.user_id), NEW.approved_by, NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER song_revision_no_update BEFORE UPDATE ON song_revision
BEGIN
 SELECT RAISE(ABORT, 'Revision snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER song_revision_no_delete BEFORE DELETE ON song_revision
BEGIN
 SELECT RAISE(ABORT, 'Revision snapshots are immutable');
END;
