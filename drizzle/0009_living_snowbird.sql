CREATE TABLE `song_submission` (
	`version_id` text PRIMARY KEY NOT NULL,
	`submission_intent` text,
	`base_revision` integer,
	`base_official_version_id` text,
	`archive_previous_on_publish` integer DEFAULT false NOT NULL,
	`make_official_on_publish` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `song_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO song_submission (version_id, submission_intent, base_revision, base_official_version_id, archive_previous_on_publish, make_official_on_publish)
SELECT id, submission_intent, base_revision, base_official_version_id, archive_previous_on_publish, make_official_on_publish
FROM song_version WHERE status = 'pending';
--> statement-breakpoint
ALTER TABLE `song_version` DROP COLUMN `submission_intent`;--> statement-breakpoint
ALTER TABLE `song_version` DROP COLUMN `base_revision`;--> statement-breakpoint
ALTER TABLE `song_version` DROP COLUMN `base_official_version_id`;--> statement-breakpoint
ALTER TABLE `song_version` DROP COLUMN `archive_previous_on_publish`;--> statement-breakpoint
ALTER TABLE `song_version` DROP COLUMN `make_official_on_publish`;
