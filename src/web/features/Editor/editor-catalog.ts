import Fuse from "fuse.js";
import { songBaseId, to_ascii } from "src/lib/song-ids";
import type { SongDataApi } from "src/worker/api/api-types";

type CatalogSong = Pick<SongDataApi, "id" | "artist" | "title">;

// Fuse thresholds range from 0 (strict) to 1 (most permissive).
const suggestionThresholds = {
  artist: 0.4,
  title: 0.4,
};
const minFuzzyQueryLength = 2;
const maxSuggestions = 5;

function normalize(value: string) {
  return to_ascii(value).toLowerCase().trim().replace(/\s+/g, " ");
}

export function indexEditorCatalog(songs: readonly CatalogSong[]) {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const artists = new Map<string, { name: string; songs: CatalogSong[] }>();

  for (const song of songs) {
    const artist = normalize(song.artist);
    if (!artist) continue;
    const entry = artists.get(artist);
    if (entry) {
      entry.songs.push(song);
    } else {
      artists.set(artist, { name: song.artist.trim(), songs: [song] });
    }
  }

  const sortedArtists = [...artists]
    .map(([key, { name }]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const artistSearch = new Fuse(sortedArtists, {
    keys: ["key"],
    ignoreLocation: true,
    threshold: suggestionThresholds.artist,
  });
  const titleSearches = new Map<string, Fuse<CatalogSong>>();

  return {
    suggestArtists(value: string) {
      const query = normalize(value);
      if (!query || artists.has(query)) return [];

      const prefixes: string[] = [];
      const otherMatches: string[] = [];
      for (const { key, name } of sortedArtists) {
        if (key.startsWith(query)) prefixes.push(name);
        else if (key.includes(query)) otherMatches.push(name);
      }
      const literalMatches = [...prefixes, ...otherMatches];
      if (query.length < minFuzzyQueryLength || literalMatches.length >= maxSuggestions) {
        return literalMatches.slice(0, maxSuggestions);
      }

      const fuzzyMatches = artistSearch.search(query)
        .filter(({ item }) => !item.key.includes(query))
        .map(({ item }) => item.name);
      return [...literalMatches, ...fuzzyMatches].slice(0, maxSuggestions);
    },

    suggestTitles(artist: string, value: string, editingSongId?: string) {
      const artistKey = normalize(artist);
      const artistSongs = artists.get(artistKey)?.songs;
      const titleKey = normalize(value);
      // A title with a trailing note like "(live)" can still match the base title.
      const query = titleKey.replace(/\s+\([^()]+\)$/, "");
      if (!artistSongs || query.length < minFuzzyQueryLength) return [];
      if (artistSongs.some((song) => normalize(song.title) === titleKey)) return [];

      let search = titleSearches.get(artistKey);
      if (!search) {
        search = new Fuse(artistSongs, {
          keys: [{ name: "title", getFn: (song) => normalize(song.title) }],
          ignoreLocation: true,
          threshold: suggestionThresholds.title,
        });
        titleSearches.set(artistKey, search);
      }

      const suggestions = new Map<string, string>();
      for (const { item } of search.search(query)) {
        if (item.id === editingSongId) continue;
        const key = normalize(item.title);
        if (!suggestions.has(key) || item.id === songBaseId(item.title, artist)) {
          suggestions.set(key, item.title);
        }
      }
      return [...suggestions.values()].slice(0, maxSuggestions);
    },

    findMatches(artist: string, title: string, editingSongId?: string) {
      const normalizedTitle = normalize(title);
      const normalizedArtist = normalize(artist);
      if (!normalizedTitle || !normalizedArtist) return { matches: [], versionTarget: undefined };

      const matches = (artists.get(normalizedArtist)?.songs ?? []).filter(
        (song) => song.id !== editingSongId && normalize(song.title) === normalizedTitle,
      );
      // The create endpoint uses the derived ID, which can differ from a metadata match.
      const versionTarget = editingSongId === undefined
        ? songsById.get(songBaseId(title, artist))
        : undefined;
      if (versionTarget && !matches.includes(versionTarget)) matches.unshift(versionTarget);
      return { matches, versionTarget };
    },
  };
}
