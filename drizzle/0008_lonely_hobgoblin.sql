PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_song` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`start_melody` text,
	`language` text NOT NULL,
	`tempo` integer,
	`capo` integer,
	`range` text,
	`chordproURL` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_song`("id", "title", "artist", "key", "created_at", "updated_at", "start_melody", "language", "capo", "range", "chordproURL", "hidden") SELECT "id", "title", "artist", "key", "created_at", "updated_at", "start_melody", "language", "capo", "range", "chordproURL", "hidden" FROM `song`;--> statement-breakpoint
DROP TABLE `song`;--> statement-breakpoint
ALTER TABLE `__new_song` RENAME TO `song`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;