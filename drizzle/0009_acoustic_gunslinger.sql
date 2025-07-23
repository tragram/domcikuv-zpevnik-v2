ALTER TABLE `songChange` RENAME TO `song_version`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_song_version` (
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
--> statement-breakpoint
INSERT INTO `__new_song_version`("id", "song_id", "user_id", "timestamp", "chordproURL", "verified", "verified_at", "verified_by_user") SELECT "id", "song_id", "user_id", "timestamp", "chordproURL", "verified", "verified_at", "verified_by_user" FROM `song_version`;--> statement-breakpoint
DROP TABLE `song_version`;--> statement-breakpoint
ALTER TABLE `__new_song_version` RENAME TO `song_version`;--> statement-breakpoint
PRAGMA foreign_keys=ON;