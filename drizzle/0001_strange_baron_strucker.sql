PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`nickname` text,
	`is_trusted` integer DEFAULT false NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_favorites_public` integer DEFAULT false NOT NULL,
	`last_login` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "created_at", "updated_at", "nickname", "is_trusted", "is_admin", "is_favorites_public", "last_login") SELECT "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "nickname", "is_trusted", "is_admin", "is_favorites_public", "last_login" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);