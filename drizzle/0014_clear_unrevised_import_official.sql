-- Clear the official selection while preserving imported versions and pins.
update "song" set "current_version_id" = null, "updated_at" = 1795456552 where "song"."current_version_id" in (select "id" from "song_version" where ("song_version"."import_id" is not null and "song_version"."revision" <= 1));
