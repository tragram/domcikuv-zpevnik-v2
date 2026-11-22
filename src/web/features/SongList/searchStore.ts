import { trimPathRight, type AnyRouter } from "@tanstack/react-router";
import { create } from "zustand";

declare module "@tanstack/react-router" {
  interface HistoryState {
    externalImportPreview?: true;
  }
}

interface QueryState {
  query: string;
  externalSearchTriggered: boolean;
  setQuery: (query: string) => void;
  triggerExternalSearch: () => void;
  endExternalSearch: () => void;
}

export const useQueryStore = create<QueryState>()((set) => ({
  query: "",
  externalSearchTriggered: false,
  setQuery: (query) =>
    set((state) =>
      state.query === query ? state : { query, externalSearchTriggered: false },
    ),
  triggerExternalSearch: () => set({ externalSearchTriggered: true }),
  endExternalSearch: () =>
    set((state) =>
      state.externalSearchTriggered
        ? { query: "", externalSearchTriggered: false }
        : state,
    ),
}));

const IMPORT_PREVIEW_DURATION_MS = 60_000;

export function trackExternalSearchNavigation(router: AnyRouter) {
  let awaitingImport = false;
  let preview: { pathname: string; expiresAt: number } | undefined;

  router.subscribe("onBeforeLoad", ({ toLocation }) => {
    const pathname = trimPathRight(toLocation.pathname);
    const { endExternalSearch } = useQueryStore.getState();

    // Check wall time before the list can mount, including after tab suspension.
    if (preview && Date.now() >= preview.expiresAt) {
      endExternalSearch();
      preview = undefined;
    }

    if (pathname === "/" || pathname === "/import") {
      // Time spent choosing another source is outside the preview window.
      preview = undefined;
      awaitingImport = pathname === "/import";
    } else if (
      pathname !== preview?.pathname &&
      !(awaitingImport && toLocation.state.externalImportPreview)
    ) {
      endExternalSearch();
      preview = undefined;
      awaitingImport = false;
    }
  });

  router.subscribe("onResolved", ({ toLocation }) => {
    if (!awaitingImport || !toLocation.state.externalImportPreview) return;

    awaitingImport = false;
    preview = {
      pathname: trimPathRight(toLocation.pathname),
      expiresAt: Date.now() + IMPORT_PREVIEW_DURATION_MS,
    };
  });
}
