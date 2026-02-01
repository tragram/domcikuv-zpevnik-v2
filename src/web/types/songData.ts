import { EditorState } from "~/features/Editor/Editor";
import { Key, SongRange } from "./musicTypes";
import type { ChordPro, int, SongLanguage } from "./types";
import { SongDataApi } from "src/worker/services/song-service";
import { ExternalSongResult } from "~/features/SongList/Toolbar/ExternalSearch";

interface CurrentIllustration {
  illustrationId: string;
  promptId: string;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
  promptURL: string;
}

const to_ascii = (text: string): string => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const sanitizeId = (id: string) => {
  return to_ascii(id)
    .replace(/ /g, "_")
    .replace(/[^A-Za-z0-9-_]+/g, "")
    .replace(/_+/g, "_");
};

export const defaultPromptId = (
  songId: string,
  summaryModel: string,
  promptVersion: string,
) => sanitizeId(`${songId}_${summaryModel}_${promptVersion}`);

export const promptFolder = (songId: string, promptId: string) =>
  promptId.replace(songId + "_", "");

export const defaultIllustrationId = (promptId: string, imageModel: string) =>
  sanitizeId(`${promptId}_${imageModel}`);

export class SongData {
  id: string;
  title: string;
  artist: string;
  key?: Key;
  createdAt: Date;
  updatedAt: Date;
  startMelody?: string;
  language: SongLanguage;
  tempo?: int;
  capo: int;
  range?: SongRange;
  chordpro: ChordPro;
  externalSource?: string;
  externalUrl?: string;

  // UI-specific fields
  currentIllustration: CurrentIllustration | undefined;
  isFavorite: boolean;

  constructor(songFromDB: SongDataApi) {
    this.id = songFromDB.id;
    this.title = songFromDB.title;
    this.artist = songFromDB.artist;
    this.key = this.parseKey(songFromDB.key);
    this.createdAt = new Date(songFromDB.createdAt);
    this.updatedAt = new Date(songFromDB.updatedAt);
    this.startMelody = songFromDB.startMelody || undefined;
    this.language = (songFromDB.language as SongLanguage) || "other";
    this.tempo = songFromDB.tempo || undefined;
    this.capo = songFromDB.capo || 0;
    this.range = this.parseRange(songFromDB.range);
    this.chordpro = songFromDB.chordpro;

    this.currentIllustration = songFromDB.currentIllustration;
    this.isFavorite = songFromDB.isFavoriteByCurrentUser;
  }

  static fromEditor(data: EditorState): SongData {
    return new SongData({
      ...data,
      id: SongData.baseId(data.title, data.artist),
      createdAt: new Date(),
      updatedAt: new Date(),
      currentIllustration: undefined,
      tempo: Number(data.tempo) || undefined,
      isFavoriteByCurrentUser: false,
      // these need to be here because of a minor type mismatch
      key: data.key,
      startMelody: data.startMelody,
      capo: data.capo,
      range: data.range,
    });
  }

  static fromExternal(external: ExternalSongResult): SongData {
    const song = new SongData({
      id: external.id,
      title: external.title,
      artist: external.artist,
      createdAt: new Date(),
      updatedAt: new Date(),
      key: undefined,
      startMelody: "",
      language: "other",
      capo: 0,
      tempo: undefined,
      range: undefined,
      chordpro: "", // External songs won't have chordpro immediately
      currentIllustration: undefined,
      isFavoriteByCurrentUser: false,
    });

    // Manually set properties that don't fit the constructor perfectly or need overrides
    song.externalSource = external.source;
    song.externalUrl = external.url;

    // Mock the illustration object so thumbnailURL() works
    if (external.thumbnailUrl) {
      song.currentIllustration = {
        thumbnailURL: external.thumbnailUrl,
        imageURL: external.thumbnailUrl,
        // Mock required fields that won't be used
        illustrationId: "ext",
        promptId: "ext",
        imageModel: "ext",
        promptURL: "",
      };
    }

    return song;
  }

  private parseKey(key?: string): Key | undefined {
    if (!key) return undefined;
    try {
      return Key.parse(key, true);
    } catch (error) {
      console.error("Error parsing key:", key, error);
      return undefined;
    }
  }

  private parseRange(range?: string): SongRange | undefined {
    return range ? new SongRange(range) : undefined;
  }

  get ascii_title(): string {
    return to_ascii(this.title);
  }

  get ascii_artist(): string {
    return to_ascii(this.artist);
  }

  static baseId(title: string, artist: string) {
    return sanitizeId(`${to_ascii(artist)}-${to_ascii(title)}`);
  }

  static empty() {
    return new SongData({
      id: "",
      title: "",
      artist: "",
      createdAt: Date(),
      updatedAt: new Date(),
      key: undefined,
      startMelody: "",
      language: "",
      capo: 0,
      tempo: undefined,
      range: "",
      chordpro: "",
      currentIllustration: undefined,
      isFavoriteByCurrentUser: false,
    });
  }

  url(): string | undefined {
    if (this.externalUrl) return this.externalUrl;
    return this.id ? `/song/${this.id}` : undefined;
  }

  // Image URL methods
  thumbnailURL(): string | undefined {
    return this.currentIllustration?.thumbnailURL;
  }

  illustrationURL(): string | undefined {
    return this.currentIllustration?.imageURL;
  }

  // JSON serialization for API responses
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      artist: this.artist,
      key: this.key?.toString(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      startMelody: this.startMelody,
      language: this.language,
      tempo: this.tempo,
      capo: this.capo,
      range: this.range?.toString(),
      chordpro: this.chordpro,
      currentIllustration: this.currentIllustration,
      isFavorite: this.isFavorite,
      url: this.url(),
      thumbnailURL: this.thumbnailURL(),
      illustrationURL: this.illustrationURL(),
    };
  }

  toChordpro(): string {
    const directives = [
      "title",
      "artist",
      "key",
      "capo",
      "tempo",
    ] as (keyof SongData)[];
    const preamble = directives
      .filter((d) => this[d])
      .map((d) => `{${d}: ${this[d]}}`)
      .join("\n");
    return preamble + "\n" + this.chordpro;
  }

  toCustomChordpro(): string {
    const directives = [
      "title",
      "artist",
      "key",
      "capo",
      "tempo",
      "range",
      "language",
      "startMelody",
    ] as (keyof SongData)[];
    const preamble = directives.map((d) =>
      this[d] instanceof Date
        ? `{${d}: ${this[d].getTime()}}`
        : `{${d}: ${this[d] ?? ""}}`,
    );

    preamble.push(`{createdAt: ${this.createdAt.getTime()}}`);
    preamble.push(
      `{illustrationId: ${this.currentIllustration?.illustrationId}}`,
    );
    preamble.push(`{promptId: ${this.currentIllustration?.promptId}}`);
    return preamble.join("\n") + "\n\n" + this.chordpro;
  }
}
