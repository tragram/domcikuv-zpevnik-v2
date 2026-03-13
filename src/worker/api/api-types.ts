import {
  IllustrationPromptDB,
  SongDataDB,
  SongIllustrationDB,
  SongImportDB,
  SongVersionDB,
} from "src/lib/db/schema";
import { z } from "zod";
import { PopulatedSongDB } from "../helpers/song-helpers";
import {
  illustrationCreateSchema,
  illustrationGenerateSchema,
  illustrationModifySchema,
} from "./admin/illustrations";
import {
  illustrationPromptCreateSchema,
  promptModifySchema,
  promptGenerateSchema,
} from "./admin/illustration-prompts";

export type ExternalSourceApi = {
  sourceId: SongImportDB["sourceId"];
  originalContent: string;
  url: string;
};

export type CurrentIllustrationApi = {
  illustrationId: string;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
  promptId: string;
  promptURL: string;
};

export type SongbookDataApi = {
  user: string;
  image: string;
  name: string;
  songIds: string[];
};

export type SongDataApi = {
  id: string;
  title: string;
  artist: string;
  key?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  startMelody?: string;
  language?: string;
  tempo?: number;
  capo?: number;
  range?: string;
  chordpro: string;
  externalSource: ExternalSourceApi | null;
  currentIllustration?: CurrentIllustrationApi;
  isFavoriteByCurrentUser: boolean;
  updateStatus?: "added" | "modified" | "deleted";
};

export type SongDataAdminApi = SongDataDB &
  SongVersionDB & { externalSource: ExternalSourceApi | null };

export type SongVersionApi = {
  id: string;
  songId: string;
  parentId?: string | null;
  importId?: string | null;
  status: SongVersionDB["status"];
  title: string;
  artist: string;
  key?: string | null;
  language?: string | null;
  capo?: number | null;
  range?: string | null;
  startMelody?: string | null;
  tempo?: string | null;
  userId: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  chordpro: string;
};

export type SongIllustrationApi = {
  id: string;
  songId: string;
  promptId: string;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deleted: boolean;
};

export type IllustrationPromptApi = {
  id: string;
  songId: string;
  summaryPromptVersion: string;
  summaryModel: string;
  text: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deleted: boolean;
};

export type UserApi = {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  role?: string;
};

export type EditorSubmissionResponse = {
  song: SongDataDB;
  version: SongVersionDB;
  status?: string;
};

export type SongWithCurrentVersionDB = SongDataDB &
  SongVersionDB & { id: string };

export type IllustrationCreateSchema = z.infer<typeof illustrationCreateSchema>;
export type IllustrationGenerateSchema = z.infer<
  typeof illustrationGenerateSchema
>;
export type IllustrationModifySchema = z.infer<typeof illustrationModifySchema>;
export type IllustrationPromptCreateSchema = z.infer<
  typeof illustrationPromptCreateSchema
>;

export type PromptModifySchema = z.infer<typeof promptModifySchema>;
export type PromptGenerateSchema = z.infer<typeof promptGenerateSchema>;

export type AdminIllustrationResponse = {
  song: PopulatedSongDB;
  illustration: SongIllustrationDB;
  prompt: IllustrationPromptDB;
};
