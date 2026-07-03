import { describe, it, expect } from "vitest";
import {
  defaultIllustrationId,
  defaultPromptId,
  promptFolder,
  sanitizeId,
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

describe("songBaseId", () => {
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
