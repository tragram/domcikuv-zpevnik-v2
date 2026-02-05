import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRouteContext } from "@tanstack/react-router";

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

export const tailwindBreakpoint = (
  breakpoint: "xs" | "xsm" | "sm" | "md" | "lg" | "xl",
) => {
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(`--breakpoint-${breakpoint}`);
  return parseInt(value, 10);
};
export function useLoggedIn() {
  const routeContext = useRouteContext({ from: "__root__" });
  return routeContext.user.loggedIn;
}

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
