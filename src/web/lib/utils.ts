import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const tailwindBreakpoint = (
  breakpoint: "xs" | "xsm" | "sm" | "md" | "lg" | "xl",
) => {
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(`--breakpoint-${breakpoint}`);
  return parseInt(value, 10);
};
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// LocalStorage Helper Functions
export const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : defaultValue;
};

export const setLocalStorageItem = <T,>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};
