PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_song_version` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`key` text,
	`language` text NOT NULL,
	`capo` integer,
	`range` text,
	`start_melody` text,
	`tempo` text,
	`user_id` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_song_version`("id", "song_id", "title", "artist", "key", "language", "capo", "range", "start_melody", "tempo", "user_id", "approved", "approved_by", "approved_at", "created_at", "updated_at") SELECT "id", "song_id", "title", "artist", "key", "language", "capo", "range", "start_melody", "tempo", "user_id", "approved", "approved_by", "approved_at", "created_at", "updated_at" FROM `song_version`;--> statement-breakpoint
DROP TABLE `song_version`;--> statement-breakpoint
ALTER TABLE `__new_song_version` RENAME TO `song_version`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `song` ADD `current_version_id` text NOT NULL REFERENCES song_version(id);--> statement-breakpoint
ALTER TABLE `song` ADD `current_illustration_id` text NOT NULL REFERENCES song_illustration(id);--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `artist`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `key`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `start_melody`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `language`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `tempo`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `capo`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `range`;--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `chordproURL`;--> statement-breakpoint
ALTER TABLE `song_illustration` DROP COLUMN `is_active`;--> statement-breakpoint
ALTER TABLE `song_illustration` DROP COLUMN `updated_at`;