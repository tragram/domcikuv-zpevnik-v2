PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_song` (
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
	`chordproURL` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_song`("id", "title", "artist", "key", "date_added", "date_modified", "start_melody", "language", "tempo", "capo", "range", "chordproURL", "hidden") SELECT "id", "title", "artist", "key", "date_added", "date_modified", "start_melody", "language", "tempo", "capo", "range", "chordproURL", "hidden" FROM `song`;--> statement-breakpoint
DROP TABLE `song`;--> statement-breakpoint
ALTER TABLE `__new_song` RENAME TO `song`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `songChange` ADD `verified` integer DEFAULT true NOT NULL;