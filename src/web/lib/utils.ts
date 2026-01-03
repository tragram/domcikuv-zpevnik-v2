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
  breakpoint: "xs" | "xsm" | "sm" | "md" | "lg" | "xl"
) => {
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(`--breakpoint-${breakpoint}`);
  return parseInt(value, 10);
};
export function useLoggedIn() {
  const routeContext = useRouteContext({ from: "__root__" });
  return routeContext.user.loggedIn;
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
