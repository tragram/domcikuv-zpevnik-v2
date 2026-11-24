// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  DEFAULT_ILLUSTRATION_MODELS,
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "src/lib/contracts/image-generation";
import type { IllustrationPromptApi } from "src/worker/api/api-types";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AIGeneratedForm from "./illustration-form/ai-generated-form";
import { PromptCreateDialog } from "./prompt-create-dialog";

const generatePrompt = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@tanstack/react-router", () => ({
  useRouteContext: () => ({ api: { admin: {} } }),
}));

vi.mock("~/services/admin-hooks", () => ({
  useCreatePrompt: () => ({}),
  useGeneratePrompt: () => ({ mutateAsync: generatePrompt }),
  useIllustrationsAdmin: () => ({ data: [] }),
  useIllustrationOptions: () => ({
    summaryModels: {
      data: SUMMARY_MODELS_API.map((value) => ({ value, label: value })),
      default: DEFAULT_ILLUSTRATION_MODELS.summaryModel,
    },
    promptVersions: {
      data: SUMMARY_PROMPT_VERSIONS.map((value) => ({ value, label: value })),
      default: SUMMARY_PROMPT_VERSIONS[0],
    },
    imageModels: {
      data: IMAGE_MODELS_API.map((value) => ({ value, label: value })),
      default: DEFAULT_ILLUSTRATION_MODELS.imageModel,
    },
  }),
}));

const [latestVersion, olderVersion, anotherVersion] = SUMMARY_PROMPT_VERSIONS;
const [savedModel, unusedModel] = SUMMARY_MODELS_API;
const savedPrompt: IllustrationPromptApi = {
  id: "saved",
  songId: "song",
  summaryModel: savedModel,
  summaryPromptVersion: olderVersion,
  text: "The first prompt for this song.",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  deleted: false,
};
const legacyPrompt: IllustrationPromptApi = {
  ...savedPrompt,
  id: "legacy",
  summaryModel: "retired-model",
  summaryPromptVersion: "custom-version",
  text: "A saved prompt using a retired model.",
};
const legacyLabel = `${legacyPrompt.summaryModel} · ${legacyPrompt.summaryPromptVersion}`;

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
  localStorage.removeItem("admin-prompt-form-activeTab");
  generatePrompt.mockClear();
  vi.unstubAllGlobals();
});

async function chooseOption(triggerIndex: number, optionText: string) {
  const select = document.querySelectorAll<HTMLButtonElement>('[role="combobox"]')[triggerIndex];
  await act(async () => {
    select.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .find((option) => option.textContent === optionText);
  expect(option).toBeDefined();
  await act(async () => option!.click());
  return select;
}

it("opens a saved model and version together and resets to the latest for an unused model", async () => {
  const onSave = vi.fn();
  await act(async () => root.render(
    <AIGeneratedForm
      illustration={{ songId: savedPrompt.songId }}
      activePromptId={savedPrompt.id}
      songPrompts={[savedPrompt, legacyPrompt]}
      onSave={onSave}
    />,
  ));

  const savedPromptSelect = await chooseOption(0, legacyLabel);
  expect(savedPromptSelect.textContent).toBe(legacyLabel);
  expect(container.querySelector('[aria-label="Summary model"]')).toBeNull();
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
    illustrationData: expect.objectContaining({
      summaryModel: legacyPrompt.summaryModel,
      promptVersion: legacyPrompt.summaryPromptVersion,
    }),
  }));

  const [existingMode, newMode] = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  await act(async () => newMode.click());
  expect(container.querySelector('[aria-label="Existing prompt"]')).toBeNull();
  await chooseOption(1, anotherVersion);
  await chooseOption(0, unusedModel);
  await act(async () => container.querySelector("form")!.requestSubmit());
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
    illustrationData: expect.objectContaining({
      summaryModel: unusedModel,
      promptVersion: latestVersion,
    }),
  }));

  await act(async () => existingMode.click());
  expect(container.querySelector('[aria-label="Existing prompt"]')?.textContent).toBe(legacyLabel);
});

it("lists saved prompt labels and defaults generation to the latest version for an unused model", async () => {
  localStorage.setItem("admin-prompt-form-activeTab", JSON.stringify("ai"));
  await act(async () => root.render(
    <PromptCreateDialog songId={savedPrompt.songId} songPrompts={[savedPrompt, legacyPrompt]} />,
  ));
  await act(async () => container.querySelector("button")!.click());

  const [generateTab, , savedTab] = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  await act(async () => {
    savedTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(legacyLabel);
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(legacyPrompt.text);
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("Generate Prompt");
  await act(async () => {
    generateTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(legacyLabel);
  await chooseOption(1, olderVersion);
  await chooseOption(0, unusedModel);
  const generateButton = [...document.querySelectorAll("button")]
    .find((button) => button.textContent === "Generate Prompt");
  await act(async () => generateButton!.click());
  expect(generatePrompt).toHaveBeenCalledWith({
    songId: savedPrompt.songId,
    summaryModel: unusedModel,
    summaryPromptVersion: latestVersion,
  });
});
