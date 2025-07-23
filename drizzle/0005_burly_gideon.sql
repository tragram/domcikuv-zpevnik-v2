ALTER TABLE `song` RENAME COLUMN "date_added" TO "created_at";--> statement-breakpoint
ALTER TABLE `song` RENAME COLUMN "date_modified" TO "updated_at";--> statement-breakpoint
ALTER TABLE `songIllustration` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Copy the value of `created_at` into `updated_at` in the same row
UPDATE `songIllustration` SET `updated_at` = `created_at`;
--> statement-breakpoint