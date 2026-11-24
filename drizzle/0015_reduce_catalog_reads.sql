CREATE INDEX `favorites_user_song` ON `favorites` (`user_id`,`song_id`);--> statement-breakpoint
CREATE INDEX `song_updated` ON `song` (`updated_at`);--> statement-breakpoint
CREATE INDEX `song_current_illustration` ON `song` (`current_illustration_id`);--> statement-breakpoint
CREATE INDEX `song_illustration_updated` ON `song_illustration` (`updated_at`);--> statement-breakpoint
CREATE INDEX `song_illustration_song_prompt_model` ON `song_illustration` (`song_id`,`prompt_id`,`image_model`);--> statement-breakpoint
CREATE INDEX `song_version_user_created` ON `song_version` (`user_id`,`created_at`);