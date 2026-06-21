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
  /** Owner's unique nickname, when set. Used as the shareable URL slug. */
  nickname: string | null;
  songIds: string[];
};

// A user's per-song songbook entry: membership + their personal pin / key / capo.
// `keyIndex` is the absolute sounding key as a pitch class (0..11), or null.
export type SongbookEntryApi = {
  songId: string;
  pinnedVersionId: string | null;
  keyIndex: number | null;
  capo: number | null;
  // The resolved displayable song, attached by both songbook endpoints ONLY for
  // a non-canonical pin — a pinned draft that isn't in the global list (a pending
  // edit, or a foreign draft someone pinned). Canonical entries omit it (resolved
  // client-side from the global list) so the payload stays small. Lets a viewer
  // render another user's songbook — including pending songs — without polluting
  // the shared SongDB.
  song?: SongDataApi;
};

export type SongDataApi = {
  id: string;
  versionId?: string;
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
  updateStatus?: "added" | "modified" | "deleted";
  // Hidden from the browse list but still reachable via search / direct link.
  hidden?: boolean;
  // True when this payload is a not-yet-public (pending) version rather than the
  // published current one — e.g. a specific version fetched for a shared session.
  isCustom?: boolean;
};

export type SongDataAdminApi = SongDataDB &
  SongVersionDB & { externalSource: ExternalSourceApi | null };

// A song version enriched with its import source (if it was imported), used by
// the admin songs table to detect/badge external songs without an extra query.
export type SongVersionAdminApi = SongVersionDB & {
  importSourceId: SongImportDB["sourceId"] | null;
  importUrl: string | null;
};

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
  approvedAt?: Date | string | null;
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
