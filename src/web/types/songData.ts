import { fileURL } from "~/lib/utils";
import { Key, Note, SongRange } from "./musicTypes";
import type { int, SongLanguage } from "./types";
import { SongDataDB } from "src/lib/db/schema";
import { SongDataApi } from "src/worker/api/songDB";

interface CurrentIllustration {
  promptId: string;
  imageModel: string;
  imageURL: string;
  thumbnailURL: string;
  promptURL: string;
}

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
  chordproURL: string;

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
    this.chordproURL = songFromDB.chordproURL;

    this.currentIllustration = songFromDB.currentIllustration;
    this.isFavorite = songFromDB.isFavoriteByCurrentUser;
  }

  private parseKey(key: string): Key | undefined {
    if (!key) return undefined;
    try {
      return Key.parse(key, true);
    } catch (error) {
      console.error("Error parsing key:", key, error);
      return undefined;
    }
  }

  private parseRange(range: string | null): SongRange | undefined {
    return range ? new SongRange(range) : undefined;
  }

  // Utility methods
  static to_ascii(text: string): string {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  get ascii_title(): string {
    return SongData.to_ascii(this.title);
  }

  get ascii_artist(): string {
    return SongData.to_ascii(this.artist);
  }

  static default_id(title: string, artist: string) {
    return `${SongData.to_ascii(artist)}-${SongData.to_ascii(title)}`
      .replace(/ /g, "_")
      .replace(/[^A-Za-z0-9-_]+/g, "")
      .replace(/_+/g, "_");
  }

  url(): string {
    return `/song/${this.id}`;
  }

  // Image URL methods
  thumbnailURL(): string {
    return this.currentIllustration?.thumbnailURL || this.defaultThumbnailURL();
  }

  illustrationURL(): string {
    return this.currentIllustration?.imageURL || this.defaultIllustrationURL();
  }

  private defaultThumbnailURL(): string {
    return fileURL(`/songs/illustrations_thumbnails/${this.id}/default.webp`);
  }

  private defaultIllustrationURL(): string {
    return fileURL(`/songs/illustrations/${this.id}/default.webp`);
  }

  static defaultChordproURL(id: string): string {
    return fileURL(`/songs/chordpro/${id}.pro`);
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
      chordproURL: this.chordproURL,
      currentIllustration: this.currentIllustration,
      isFavorite: this.isFavorite,
      url: this.url(),
      thumbnailURL: this.thumbnailURL(),
      illustrationURL: this.illustrationURL(),
    };
  }
}
