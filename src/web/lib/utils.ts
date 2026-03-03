import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// LocalStorage Helper Functions
export const getLocalStorageItem = (key: string, defaultValue: any) => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : defaultValue;
};

export const setLocalStorageItem = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const fileURL = (url: string) => {
  // this is partially a relic of the past but also might be reused in the future should a full-stack framework be used
  return url;
};

/**
 * Converts English chord names to Central European notation (H/B system)
 * This is the system used in Czech, German, Polish, Nordic countries, etc.
 */
export function convertChordNotation(chord: string): string {
    if (!chord) return chord;

    const trimmedChord = chord.trim();

    // Handle B flat (Bb) becoming B in Central European notation
    if (trimmedChord.startsWith("Bb")) {
        return "B" + trimmedChord.slice(2);
    }
    // Handle B becoming H in Central European notation
    else if (trimmedChord.startsWith("B")) {
        return "H" + trimmedChord.slice(1);
    }
    // Handle chords ending with Bb
    else if (trimmedChord.endsWith("Bb")) {
        return trimmedChord.slice(0, -2) + "B";
    }
    // Handle chords ending with B
    else if (trimmedChord.endsWith("B")) {
        return trimmedChord.slice(0, -1) + "H";
    }

    return chord;
}

export const getInitials = (name: string) => {
  if (!name) {
    return "?";
  }
  const splitName = name.split(" ");
  if (splitName.length > 1) {
    return splitName
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
};

export function guessLanguage(lyrics: string) {
  // extremely basic heuristic to guess which language a song is
  // apart from special characters and words it also takes into account the prior of importing that actual language...
  if (
    lyrics.search("ř") !== -1 ||
    lyrics.search("ž") !== -1 ||
    lyrics.search("ů") !== -1 ||
    lyrics.search("ť") !== -1 ||
    lyrics.search("ď") !== -1 ||
    lyrics.search("ě") !== -1
  ) {
    return "czech";
  }

  if (
    (lyrics.match(/ the /g) || []).length > 3 ||
    lyrics.search("would") !== -1 ||
    lyrics.search("which") !== -1 ||
    lyrics.search("because") !== -1 ||
    lyrics.search("I'm") !== -1
  ) {
    return "english";
  }

  if (
    lyrics.search("ñ") !== -1 ||
    lyrics.search("cuando") !== -1 ||
    lyrics.search("porque") !== -1 ||
    lyrics.search("también") !== -1
  ) {
    return "spanish";
  }
  if (
    lyrics.search("ô") !== -1 ||
    lyrics.search("ĺ") !== -1 ||
    lyrics.search("ŕ") !== -1 ||
    lyrics.search("ľ") !== -1
  ) {
    return "slovak";
  }
  return "other";
}
