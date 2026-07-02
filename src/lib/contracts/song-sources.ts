// Shared client/server contract: the set of supported external song sources.
// Lives outside the drizzle schema so client code can import it without
// pulling the ORM into the bundle (song.schema.ts imports it for the enum column).

export const SONG_SOURCES = [
  "pisnicky-akordy",
  "zpevnik-skorepova",
  "cifraclub",
] as const;

export type SongSourceId = (typeof SONG_SOURCES)[number];

export const SONG_SOURCES_PRETTY: Record<SongSourceId, string> = {
  "pisnicky-akordy": "Písničky-Akordy",
  "zpevnik-skorepova": "Zpěvník Skořepová",
  cifraclub: "CifraClub",
};
