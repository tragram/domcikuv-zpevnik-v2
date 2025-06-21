import { SongData } from "~/types/songData";
import { LanguageCount, SongDB } from "~/types/types";
import yaml from "js-yaml";
import { fileURL } from "./utils";
import { guessKey } from "~/features/SongView/utils/songRendering";

export const fetchSongDB = async () => {
  const response = await fetch(fileURL("/songDB.json"));
  if (!response.ok)
    throw new Error("Failed to fetch songDB!", { cause: response });
  const songDBData = await response.json();
  const songs = songDBData.map((d) => new SongData(d));

  const languages: LanguageCount = songs
    .map((s) => s.language)
    .reduce((acc: Record<string, number>, lang: string) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});
  const songbooks = [...new Set(songs.map((s) => s.songbooks).flat())];

  const songRanges = songs.map((s) => s.range?.semitones).filter(Boolean);
  const songDB = {
    maxRange: Math.max(...songRanges),
    songbooks: songbooks,
    languages,
    songs,
  };
  return songDB;
};

export const fetchIllustrationPrompt = async (songId: string) => {
  const response = await fetch(SongData.promptURL(songId));
  if (response.ok) {
    const promptContent = await response.text();
    // TODO: this probably is not always the correct prompt...
    return yaml.load(promptContent)[0].response;
  } else {
    throw Error("Could not load image prompt!");
  }
};

export const fetchSong = async (songId: string, songDB: SongDB) => {
  const response = await fetch(SongData.chordproURL(songId));
  if (!response.ok) {
    throw Error("Could not fetch song data!");
  }
  const songRawData = await response.text();

  // TODO: this should be preparsed...
  const songIdsAndIllustrations = songDB.songs.map((s) => ({
    id: SongData.id(s.title, s.artist),
    availableIllustrations: s.illustrationData.availableIllustrations,
  }));
  const availableIllustrations = songIdsAndIllustrations.find(
    (song) => song.id === songId
  )?.availableIllustrations;
  
  const songData = SongData.fromChordpro(songRawData, availableIllustrations);

  if (!songData.key) {
    songData.key = guessKey(songData.content || "");
  }

  return songData;
};
