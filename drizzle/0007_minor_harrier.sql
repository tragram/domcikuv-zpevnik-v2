ALTER TABLE `songChange` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `songChange` ADD `verified_by_user` text REFERENCES user(id);