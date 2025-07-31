ALTER TABLE `illustration_prompt` ADD `created_at` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `illustration_prompt` ADD `updated_at` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `illustration_prompt` ADD `deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `song_illustration` ADD `updated_at` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `song_illustration` ADD `deleted` integer DEFAULT false NOT NULL;