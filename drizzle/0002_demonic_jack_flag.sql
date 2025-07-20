CREATE TABLE `song` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`key` text NOT NULL,
	`date_added` integer NOT NULL,
	`date_modified` integer NOT NULL,
	`start_melody` text,
	`language` text NOT NULL,
	`tempo` text,
	`capo` integer,
	`range` text,
	`chordproURL` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `songChange` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`user_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`chordproURL` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `songIllustration` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`prompt_model` text NOT NULL,
	`image_model` text NOT NULL,
	`image_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_favorites` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`song_id` text NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_favorites`("id", "user_id", "song_id", "added_at") SELECT "id", "user_id", "song_id", "added_at" FROM `favorites`;--> statement-breakpoint
DROP TABLE `favorites`;--> statement-breakpoint
ALTER TABLE `__new_favorites` RENAME TO `favorites`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;