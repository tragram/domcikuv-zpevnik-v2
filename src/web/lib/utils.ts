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

// TODO: delete this ugly baseURL (when proper client-side rendering is available - https://github.com/TanStack/router/discussions/3264)
export const fileURL = (url: string) => {
  // if (typeof window === "undefined") {
  //   console.log("server :(");
  // } else console.log("client! :)");
  const base = ""; //import.meta.env.DEV ? "http://localhost:3000" : "";
  return base + url;
};
