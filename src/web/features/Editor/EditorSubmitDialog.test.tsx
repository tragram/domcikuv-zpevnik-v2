// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SongData } from "~/types/songData";
import type { EditorState } from "~/types/types";
import { EditorSubmitDialog } from "./EditorSubmitDialog";

const song = new SongData({ id: "song", title: "Song", artist: "Artist",
  chordpro: "[C]one two three four five six seven eight nine ten eleven twelve",
  externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01",
  versionStatus: "published", isOfficial: true, versionAuthorId: "owner" });
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("preselects based on the completed edit and submits the user's explicit choice", async () => {
  const confirm = vi.fn();
  const state = { ...song.toJSON(), chordpro: "Completely rewritten lyrics and a new arrangement" } as EditorState;
  await act(async () => root.render(<EditorSubmitDialog song={song} state={state} actor={{ id: "owner" }}
    publishing={false} submitting={false} onConfirm={confirm} onClose={vi.fn()} />));
  const dialog = document.querySelector('[role="dialog"]')!;
  const radios = dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(radios[1].checked).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  await act(async () => radios[0].click());
  const submit = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Submit")!;
  await act(async () => submit.click());
  expect(confirm).toHaveBeenCalledWith({ saveMode: "correction", archivePreviousOnPublish: false, makeOfficialOnPublish: false });
});

it("recommends a revision for a small edit and lets the user cancel without saving", async () => {
  const confirm = vi.fn(), close = vi.fn();
  const state = { ...song.toJSON(), chordpro: song.chordpro.replace("twelve", "thirteen") } as EditorState;
  await act(async () => root.render(<EditorSubmitDialog song={song} state={state} actor={{ id: "owner" }}
    publishing={false} submitting={false} onConfirm={confirm} onClose={close} />));
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.querySelector<HTMLInputElement>('input[type="radio"]')?.checked).toBe(true);
  await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Cancel")!.click());
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});
