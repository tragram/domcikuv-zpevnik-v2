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
  let preview: {
    pathname: string;
    expiresAt: number;
    search: QueryState;
    timer: ReturnType<typeof setTimeout>;
  } | undefined;

  const clearPreview = () => {
    if (!preview) return;
    clearTimeout(preview.timer);
    preview = undefined;
  };

  const expirePreview = () => {
    if (preview?.search === useQueryStore.getState()) {
      preview.search.endExternalSearch();
    }
    clearPreview();
  };

  const beforeLoad = router.subscribe("onBeforeLoad", ({ toLocation }) => {
    const pathname = trimPathRight(toLocation.pathname);

    // Check wall time before rendering in case the browser deferred the timer.
    if (preview && Date.now() >= preview.expiresAt) expirePreview();

    if (pathname === "/" || pathname === "/import") {
      awaitingImport = pathname === "/import";
    } else if (
      pathname !== preview?.pathname &&
      !(awaitingImport && toLocation.state.externalImportPreview)
    ) {
      useQueryStore.getState().endExternalSearch();
      clearPreview();
      awaitingImport = false;
    }
  });

  const onResolved = router.subscribe("onResolved", ({ toLocation }) => {
    if (!awaitingImport || !toLocation.state.externalImportPreview) return;

    awaitingImport = false;
    clearPreview();
    const search = useQueryStore.getState();
    if (!search.externalSearchTriggered) return;
    preview = {
      pathname: trimPathRight(toLocation.pathname),
      expiresAt: Date.now() + IMPORT_PREVIEW_DURATION_MS,
      search,
      timer: setTimeout(expirePreview, IMPORT_PREVIEW_DURATION_MS),
    };
  });

  return () => {
    beforeLoad();
    onResolved();
    clearPreview();
  };
}
