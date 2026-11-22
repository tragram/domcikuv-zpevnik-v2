import type { SongVersionDB } from "../../src/lib/db/schema";
import { formatChordpro } from "../../src/web/lib/formatChordpro";
import { SongData } from "../../src/web/types/songData";

type SnapshotSheet = Pick<SongVersionDB,
  "songId" | "title" | "artist" | "key" | "createdAt" | "updatedAt" | "startMelody" |
  "language" | "tempo" | "capo" | "range" | "chordpro"
>;

export function renderSnapshotSheet(
  version: SnapshotSheet,
  illustration?: ConstructorParameters<typeof SongData>[0]["currentIllustration"],
) {
  const sheet = new SongData({
    id: version.songId,
    title: version.title || "Unknown",
    artist: version.artist || "Unknown",
    key: version.key || undefined,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    startMelody: version.startMelody || undefined,
    language: version.language || "other",
    tempo: version.tempo ? Number(version.tempo) : undefined,
    capo: version.capo || 0,
    range: version.range || undefined,
    chordpro: version.chordpro,
    externalSource: null,
    currentIllustration: illustration,
    isFavoriteByCurrentUser: false,
  });
  return formatChordpro(sheet.toCustomChordpro());
}
