import { Key, SongRange } from "./musicTypes";
import type { ChordPro, EditorState, int, SongLanguage } from "./types";
import {
  CurrentIllustrationApi,
  ExternalSourceApi,
  SongDataApi,
} from "src/worker/api/api-types";
import { ExternalSearchResult } from "src/worker/helpers/external-search";

const to_ascii = (text: string): string => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const sanitizeId = (id: string) => {
  return to_ascii(id)
    .replace(/ /g, "_")
    .replace(/[^A-Za-z0-9-_.]+/g, "")
    .replace(/_+/g, "_");
};

const generateFallbackLogo = (bgColor: string, fgColor: string): string => {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect fill="${bgColor}" width="1204" height="1263" x="-66" y="-89" />
    <g transform="translate(0,12)">
      <g transform="matrix(3.9881201,0,0,3.9881201,-891.73511,-1091.1055)" fill="${fgColor}">
        <path d="m 285.92551,358.08122 c 0,0 -15.50153,29.85651 16.52314,83.23096 32.04467,53.40778 52.28712,60.221 56.5781,60.26501 4.29099,0.044 24.53952,-6.85593 56.5246,-60.16438 32.02467,-53.37445 16.52314,-83.22891 16.52313,-83.22891 0,0 -9.15513,-35.61997 -73.06258,-35.76089 -63.90744,-0.14093 -73.08634,35.65835 -73.08634,35.65835 z" />
        <path d="m 289.40525,359.64878 c 0,0 -14.76336,28.43477 15.73633,79.26758 30.51873,50.86455 49.79725,57.35333 53.8839,57.39525 4.08666,0.0419 23.37097,-6.52946 53.83295,-57.29941 30.49969,-50.83281 15.73633,-79.26563 15.73632,-79.26563 0,0 -8.71917,-33.92378 -69.58341,-34.05799 -60.86423,-0.13422 -69.60604,33.96033 -69.60604,33.96033 z" />
      </g>
    </g>
  </svg>`;

  // encodeURIComponent is crucial here so that the '#' in hex codes doesn't break the URL
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
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
  capo?: int;
  range?: SongRange;
  chordpro: ChordPro;
  externalSource: ExternalSourceApi | null;

  // UI-specific fields
  currentIllustration: CurrentIllustrationApi | undefined;
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

    // Safely assign 0 if it exists, otherwise undefined (not forcing 0 for empty states)
    this.capo = songFromDB.capo !== null ? songFromDB.capo : undefined;

    this.range = this.parseRange(songFromDB.range);
    this.chordpro = songFromDB.chordpro;
    this.externalSource = songFromDB.externalSource;

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
      key: data.key,
      startMelody: data.startMelody,
      // Safely parse strings to numbers, falling back to null for the DB Api
      capo: data.capo === "" || data.capo == null ? null : Number(data.capo),
      range: data.range,
      externalSource: null,
    } as unknown as SongDataApi); // Assert type to bypass strict interface checks on EditorState overlap
  }

  static fromExternalSearch(external: ExternalSearchResult): SongData {
    const song = new SongData({
      id: external.id,
      title: external.title,
      artist: external.artist,
      createdAt: new Date(),
      updatedAt: new Date(),
      key: undefined,
      startMelody: "",
      language: "other",
      capo: null, // Replaced 0 with null to match DB
      tempo: null,
      range: undefined,
      chordpro: "",
      currentIllustration: undefined,
      isFavoriteByCurrentUser: false,
      externalSource: {
        sourceId: external.sourceId,
        originalContent: "",
        url: external.url,
      },
    } as unknown as SongDataApi);

    song.url = () => external.url;
    song.thumbnailURL = () => external.thumbnailURL;
    song.illustrationURL = () => external.thumbnailURL;

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
      createdAt: new Date(),
      updatedAt: new Date(),
      key: undefined,
      startMelody: "",
      language: "other",
      capo: null, // Replaced 0 with null to match DB
      tempo: null,
      range: undefined,
      chordpro: "",
      currentIllustration: undefined,
      isFavoriteByCurrentUser: false,
      externalSource: null,
    } as unknown as SongDataApi);
  }

  url(): string | undefined {
    return this.id ? `/song/${this.id}` : undefined;
  }

  // Image URL methods
  thumbnailURL(): string | undefined {
    if (!this.currentIllustration) {
      if (this.externalSource?.sourceId === "pisnicky-akordy")
        return generateFallbackLogo("#7BAADF", "#578DC5");
      if (this.externalSource?.sourceId === "cifraclub")
        return generateFallbackLogo("#ffb940", "#ff7800");
      if (this.externalSource?.sourceId === "zpevnik-skorepova")
        return generateFallbackLogo("#9917DA", "#3B0A54");
    }
    return (
      this.currentIllustration?.thumbnailURL ??
      generateFallbackLogo("#ffc48c", "#f28c28")
    );
  }

  illustrationURL(): string | undefined {
    if (!this.currentIllustration) {
      if (this.externalSource?.sourceId === "pisnicky-akordy")
        return generateFallbackLogo("#7BAADF", "#578DC5");
      if (this.externalSource?.sourceId === "cifraclub")
        return generateFallbackLogo("#ffb940", "#ff7800");
      if (this.externalSource?.sourceId === "zpevnik-skorepova")
        return generateFallbackLogo("#9917DA", "#3B0A54");
    }
    return (
      this.currentIllustration?.imageURL ??
      generateFallbackLogo("#ffc48c", "#f28c28")
    );
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
      externalSource: this.externalSource,
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
      .filter((d) => this[d] !== undefined && this[d] !== null)
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

    // Map only the directives that actually have values
    const preamble = directives
      .filter(
        (d) => this[d] !== undefined && this[d] !== null && this[d] !== "",
      )
      .map((d) => `{${d}: ${this[d]}}`);

    preamble.push(`{createdAt: ${this.createdAt.getTime()}}`);
    preamble.push(`{updatedAt: ${this.updatedAt.getTime()}}`);

    if (this.currentIllustration?.illustrationId) {
      preamble.push(
        `{illustrationId: ${this.currentIllustration.illustrationId}}`,
      );
      preamble.push(`{promptId: ${this.currentIllustration.promptId}}`);
    }

    return preamble.join("\n") + "\n\n" + this.chordpro;
  }
}
