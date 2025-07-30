PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_song` (
	`id` text PRIMARY KEY NOT NULL,
	`current_version_id` text,
	`current_illustration_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`current_version_id`) REFERENCES `song_version`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_illustration_id`) REFERENCES `song_illustration`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_song`("id", "current_version_id", "current_illustration_id", "created_at", "updated_at", "hidden", "deleted") SELECT "id", "current_version_id", "current_illustration_id", "created_at", "updated_at", "hidden", "deleted" FROM `song`;--> statement-breakpoint
DROP TABLE `song`;--> statement-breakpoint
ALTER TABLE `__new_song` RENAME TO `song`;--> statement-breakpoint
PRAGMA foreign_keys=ON;