// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPersistedCache } from "src/lib/query-client";
import { getEditorBackupKey, getEditorStateKey } from "~/features/Editor/editor-storage";
import { getIsOnline, useIsOnline } from "~/hooks/use-is-online";
import { retryAppLoad } from "~/services/app-updates";
import { CustomError } from "./CustomError";
import { NotFound } from "./NotFound";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("src/lib/query-client", () => ({ clearPersistedCache: vi.fn() }));
vi.mock("~/hooks/use-is-online", () => ({ getIsOnline: vi.fn(), useIsOnline: vi.fn() }));
vi.mock("~/services/app-updates", async (importOriginal) => ({
  ...await importOriginal<typeof import("~/services/app-updates")>(),
  retryAppLoad: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getIsOnline).mockReturnValue(true);
  vi.mocked(useIsOnline).mockReturnValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function button(label: string, scope: Document | HTMLDivElement = container) {
  return Array.from(scope.querySelectorAll("button")).find((item) => item.textContent === label)!;
}

async function renderError(message: string) {
  await act(async () => root.render(<CustomError error={new Error(message)} reset={vi.fn()} />));
}

it("offers a songbook link on the missing page without a reset", async () => {
  await act(async () => root.render(<NotFound />));
  expect(container.querySelector("h1")?.textContent).toBe("We couldn’t find this page");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/");
  expect(container.querySelector("button")).toBeNull();
});

it.each([
  ["Failed to fetch dynamically imported module: /assets/song.js", true],
  ["Could not load song", false],
])("passes the right recovery hint for %s", async (message, checkForNewBuild) => {
  await renderError(message);
  expect(container.querySelector("details")?.open).toBe(false);
  await act(async () => button("Try again").click());
  expect(retryAppLoad).toHaveBeenCalledExactlyOnceWith(checkForNewBuild);
  expect(clearPersistedCache).not.toHaveBeenCalled();
});

it("asks before clearing offline data and preserves settings and draft backups", async () => {
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  vi.mocked(clearPersistedCache).mockResolvedValue(undefined);
  const backupKey = getEditorBackupKey(getEditorStateKey("song", "version"));
  localStorage.setItem("vite-ui-theme", "dark");
  localStorage.setItem(backupKey, "draft");
  sessionStorage.setItem("session-setting", "saved");
  await renderError("Could not load song");

  await act(async () => button("Repair app").click());
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("removes offline song data");
  expect(clearPersistedCache).not.toHaveBeenCalled();
  await act(async () => button("Cancel", document).click());
  expect(clearPersistedCache).not.toHaveBeenCalled();

  await act(async () => button("Repair app").click());
  await act(async () => button("Repair and reload", document).click());
  expect(clearPersistedCache).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("vite-ui-theme")).toBe("dark");
  expect(localStorage.getItem(backupKey)).toBe("draft");
  expect(sessionStorage.getItem("session-setting")).toBe("saved");
});

it("keeps offline data available when disconnected", async () => {
  vi.mocked(getIsOnline).mockReturnValue(false);
  vi.mocked(useIsOnline).mockReturnValue(false);
  await renderError("Could not load song");
  expect(button("Try again").disabled).toBe(false);
  expect(button("Repair app").disabled).toBe(true);
  expect(clearPersistedCache).not.toHaveBeenCalled();
});

it("reinstalls the app files after a module failure and keeps the song cache", async () => {
  const scope = new URL("/", window.location.href).href;
  const unregister = vi.fn().mockResolvedValue(true);
  const deleteCache = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), {
    serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ scope, unregister }) },
  }));
  vi.stubGlobal("caches", { delete: deleteCache });
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  await renderError("Songbook asset: Failed to fetch dynamically imported module: /assets/index.js");
  await act(async () => button("Repair app").click());
  await act(async () => button("Repair and reload", document).click());
  expect(unregister).toHaveBeenCalledOnce();
  expect(deleteCache).toHaveBeenCalledExactlyOnceWith(`workbox-precache-v2-${scope}`);
  expect(clearPersistedCache).not.toHaveBeenCalled();
  expect(reload).toHaveBeenCalledOnce();
});
