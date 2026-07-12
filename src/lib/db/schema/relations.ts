import { user } from "./auth.schema";
import { userFavoriteSongs } from "./favorites.schema";
import {
  illustrationPrompt,
  song,
  songIllustration,
  songImport,
  songVersion,
} from "./song.schema";
import { relations } from "drizzle-orm";

// Relations for efficient querying. The current version/illustration are not
// relations anymore: they're derived (status = 'published' / isCurrent) via
// filtered `version`/`illustration` fetches in song-helpers.
export const songRelations = relations(song, ({ many }) => ({
  // Get all illustrations & versions for this song
  illustration: many(songIllustration),
  version: many(songVersion),
  favorites: many(userFavoriteSongs),
}));

export const songIllustrationRelations = relations(
  songIllustration,
  ({ one }) => ({
    song: one(song, {
      fields: [songIllustration.songId],
      references: [song.id],
    }),
  }),
);

export const songVersionRelations = relations(songVersion, ({ one }) => ({
  song: one(song, { fields: [songVersion.songId], references: [song.id] }),
  user: one(user, { fields: [songVersion.userId], references: [user.id] }),
  approver: one(user, {
    fields: [songVersion.approvedBy],
    references: [user.id],
  }),
  parent: one(songVersion, {
    fields: [songVersion.parentId],
    references: [songVersion.id],
  }),

  songImport: one(songImport, {
    fields: [songVersion.importId],
    references: [songImport.id],
  }),
}));

export const illustrationPromptRelations = relations(
  illustrationPrompt,
  ({ one }) => ({
    song: one(song, {
      fields: [illustrationPrompt.songId],
      references: [song.id],
    }),
  }),
);

export const userFavoriteSongsRelations = relations(
  userFavoriteSongs,
  ({ one }) => ({
    song: one(song, {
      fields: [userFavoriteSongs.songId],
      references: [song.id],
    }),
    user: one(user, {
      fields: [userFavoriteSongs.userId],
      references: [user.id],
    }),
    pinnedVersion: one(songVersion, {
      fields: [userFavoriteSongs.pinnedVersionId],
      references: [songVersion.id],
    }),
  }),
);
