PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_song_illustration` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`image_model` text NOT NULL,
	`image_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prompt_id`) REFERENCES `illustration_prompt`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_song_illustration`("id", "song_id", "prompt_id", "image_model", "image_url", "thumbnail_url", "is_active", "created_at", "updated_at") SELECT "id", "song_id", "prompt_id", "image_model", "image_url", "thumbnail_url", "is_active", "created_at", "updated_at" FROM `song_illustration`;--> statement-breakpoint
DROP TABLE `song_illustration`;--> statement-breakpoint
ALTER TABLE `__new_song_illustration` RENAME TO `song_illustration`;--> statement-breakpoint
PRAGMA foreign_keys=ON;