CREATE TABLE `illustration_prompt` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`summary_model` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `song_illustration` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`prompt_id` text,
	`source_type` text NOT NULL,
	`image_model` text NOT NULL,
	`image_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prompt_id`) REFERENCES `illustration_prompt`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prompt_constraint" CHECK((source_type = 'lyricsDirectly') OR (source_type = 'summary' AND prompt_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `song_version` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`user_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`chordproURL` text NOT NULL,
	`verified` integer DEFAULT true NOT NULL,
	`verified_at` integer,
	`verified_by_user` text,
	FOREIGN KEY (`song_id`) REFERENCES `song`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by_user`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
