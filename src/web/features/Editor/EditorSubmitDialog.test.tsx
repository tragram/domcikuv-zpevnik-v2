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
  const radios = dialog.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  expect(radios[1].getAttribute("aria-checked")).toBe("true");
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
  expect(dialog.querySelector('[role="radio"]')?.getAttribute("aria-checked")).toBe("true");
  await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Cancel")!.click());
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});

it("shows editable version details only for a replacement or alternative", async () => {
  const confirm = vi.fn();
  const state: EditorState = {
    title: song.title,
    artist: song.artist,
    chordpro: song.chordpro.replace("twelve", "thirteen"),
    label: "Acoustic",
    description: "One guitar",
  };
  await act(async () => root.render(<EditorSubmitDialog song={song} state={state} actor={{ id: "owner" }}
    publishing={false} submitting={false} onConfirm={confirm} onClose={vi.fn()} />));
  const dialog = document.querySelector('[role="dialog"]')!;
  const [revision, separateVersion] = dialog.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  const submit = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Submit")!;

  expect(dialog.querySelector('input[type="text"]')).toBeNull();
  await act(async () => separateVersion.click());
  const [name, description] = dialog.querySelectorAll<HTMLInputElement>('input[type="text"]');
  expect(name.value).toBe("Acoustic");
  expect(description.value).toBe("One guitar");

  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setInputValue.call(name, "x".repeat(21));
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(submit.disabled).toBe(true);
  await act(async () => revision.click());
  expect(dialog.querySelector('input[type="text"]')).toBeNull();
  expect(submit.disabled).toBe(false);

  await act(async () => separateVersion.click());
  const updatedName = dialog.querySelector<HTMLInputElement>('input[type="text"]')!;
  await act(async () => {
    setInputValue.call(updatedName, "Live");
    updatedName.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const [makeOfficial, archive] = dialog.querySelectorAll<HTMLButtonElement>('[role="checkbox"]');
  expect(makeOfficial.getAttribute("aria-checked")).toBe("true");
  expect(archive.getAttribute("aria-checked")).toBe("true");
  await act(async () => makeOfficial.click());
  expect(archive.disabled).toBe(true);
  expect(archive.getAttribute("aria-checked")).toBe("false");
  await act(async () => submit.click());
  expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
    saveMode: "new-version",
    label: "Live",
    description: "One guitar",
    makeOfficialOnPublish: false,
    archivePreviousOnPublish: false,
  }));
});
