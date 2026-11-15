import { describe, it, expect } from "vitest";
import {
  defaultIllustrationId,
  defaultPromptId,
  promptFolder,
  sanitizeId,
  sanitizePathSegment,
  songBaseId,
  to_ascii,
} from "./song-ids";

describe("to_ascii", () => {
  it("strips diacritics", () => {
    expect(to_ascii("Žluťoučký kůň")).toBe("Zlutoucky kun");
  });

  it("leaves plain ASCII unchanged", () => {
    expect(to_ascii("Hello World")).toBe("Hello World");
  });
});

describe("sanitizeId", () => {
  it("removes trailing periods after other normalization", () => {
    expect(sanitizeId("Tomáš Klus-Až...!")).toBe("tomas_klus-az");
    expect(sanitizeId("name.")).toBe("name");
    expect(sanitizeId("...")).toBe("");
  });

  it("preserves internal periods and is idempotent", () => {
    expect(sanitizeId("gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(sanitizeId("anna_k.-noc_na_zemi")).toBe("anna_k.-noc_na_zemi");
    const id = sanitizeId("Tomáš Klus-Až...");
    expect(sanitizeId(id)).toBe(id);
  });
  it("lowercases and replaces spaces with underscores", () => {
    expect(sanitizeId("Hello World")).toBe("hello_world");
  });

  it("strips diacritics before sanitizing", () => {
    expect(sanitizeId("Škoda Octavia")).toBe("skoda_octavia");
  });

  it("drops disallowed characters", () => {
    expect(sanitizeId("a!b@c#d")).toBe("abcd");
  });

  it("collapses repeated underscores", () => {
    expect(sanitizeId("a   b")).toBe("a_b");
  });
});

describe("sanitizePathSegment", () => {
  it("preserves existing model filenames instead of normalizing them as IDs", () => {
    expect(sanitizePathSegment("FLUX.1-dev")).toBe("FLUX.1-dev");
    expect(sanitizeId("FLUX.1-dev")).toBe("flux.1-dev");
    expect(sanitizePathSegment("Hello World")).toBe("Hello-World");
    expect(sanitizeId("Hello World")).toBe("hello_world");
  });

  it("substitutes unsupported path characters and keeps the legacy fallback", () => {
    expect(sanitizePathSegment("vendor/model")).toBe("vendor-model");
    expect(sanitizePathSegment("--model//variant--")).toBe("model-variant");
    expect(sanitizePathSegment("")).toBe("unknown");
  });
});

describe("songBaseId", () => {
  it("matches repeated imports regardless of trailing title periods", () => {
    expect(songBaseId("Až...", "Tomáš Klus")).toBe("tomas_klus-az");
    expect(songBaseId("Až...", "Tomáš Klus")).toBe(songBaseId("Až", "Tomáš Klus"));
    const songId = songBaseId("Až...", "Tomáš Klus");
    expect(promptFolder(songId, defaultPromptId(songId, "gpt-5.4-mini", "v7")))
      .toBe("gpt-5.4-mini_v7");
  });
  it("joins artist and title with a dash, sanitized", () => {
    expect(songBaseId("Yesterday", "The Beatles")).toBe(
      "the_beatles-yesterday",
    );
  });
});

describe("defaultPromptId / promptFolder", () => {
  it("builds a prompt id from song id, model, and version", () => {
    expect(defaultPromptId("my-song", "gpt-4", "v1")).toBe(
      "my-song_gpt-4_v1",
    );
  });

  it("recovers the folder by stripping the songId prefix", () => {
    const songId = "my-song";
    const promptId = defaultPromptId(songId, "gpt-4", "v1");
    expect(promptFolder(songId, promptId)).toBe("gpt-4_v1");
  });
});

describe("defaultIllustrationId", () => {
  it("builds an illustration id from prompt id and image model", () => {
    expect(defaultIllustrationId("my-song_gpt-4_v1", "sdxl")).toBe(
      "my-song_gpt-4_v1_sdxl",
    );
  });
});
