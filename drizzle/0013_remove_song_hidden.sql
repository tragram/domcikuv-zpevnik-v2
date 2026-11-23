-- Remove the legacy hidden song using the same deletion state as the admin action.
update "song_illustration" set "updated_at" = 1795452286, "deleted" = 1 where "song_illustration"."song_id" in (select "id" from "song" where ("song"."id" = 'hustej_wimpy-jede_srot_jede_srot' and "song"."hidden" = 1));
--> statement-breakpoint
update "illustration_prompt" set "updated_at" = 1795452286, "deleted" = 1 where "illustration_prompt"."song_id" in (select "id" from "song" where ("song"."id" = 'hustej_wimpy-jede_srot_jede_srot' and "song"."hidden" = 1));
--> statement-breakpoint
update "song" set "updated_at" = 1795452286, "deleted" = 1 where "song"."id" in (select "id" from "song" where ("song"."id" = 'hustej_wimpy-jede_srot_jede_srot' and "song"."hidden" = 1));
--> statement-breakpoint
CREATE INDEX `song_version_song_status_created` ON `song_version` (`song_id`,`status`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `song` DROP COLUMN `hidden`;
