import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { getR2Key, sanitizePathSegment } from "./sync-utils";
import { SongData } from "../web/types/songData";

describe("GitHub Sync Utilities", () => {
  describe("sanitizePathSegment", () => {
    it("should strip invalid path characters and replace with dashes", () => {
      expect(sanitizePathSegment("model/name-v1.0")).toBe("model-name-v1.0");
      expect(sanitizePathSegment("weird\\path?chars*")).toBe(
        "weird-path-chars",
      );
    });

    it("should collapse multiple dashes and trim edges", () => {
      expect(sanitizePathSegment("---too---many---dashes---")).toBe(
        "too-many-dashes",
      );
      expect(sanitizePathSegment("-start-and-end-")).toBe("start-and-end");
    });

    it("should handle empty or null values gracefully", () => {
      expect(sanitizePathSegment(null)).toBe("unknown");
    });
  });

  describe("getR2Key", () => {
    it("should extract the base R2 key from a standard URL", () => {
      expect(getR2Key("https://pub-abc.r2.dev/folder/image.webp")).toBe(
        "folder/image.webp",
      );
    });

    it("should extract the R2 key from a Cloudflare CDN CGI URL", () => {
      const cgiUrl = "/cdn-cgi/image/width=800,quality=75/folder/image.webp";
      expect(getR2Key(cgiUrl)).toBe("folder/image.webp");
    });

    it("should handle raw paths without hostnames", () => {
      expect(getR2Key("/folder/image.webp")).toBe("folder/image.webp");
    });
  });

  describe("YAML Generation Mapping", () => {
    it("should correctly format illustration metadata into YAML", () => {
      // Arrange: Mock the exact data structure built inside index.ts
      const metadata = {
        songId: "test_song_123",
        prompts: [
          {
            id: "prompt_1",
            text: "A beautiful acoustic guitar on a porch",
            illustrations: [
              {
                createdAt: 1708538216000,
                imageModel: "flux-schnell",
                filename: "flux-schnell.webp",
              },
            ],
          },
        ],
      };

      // Act
      const yamlOutput = yaml.dump(metadata);

      // Assert: Check that it's a string and contains expected YAML formatting
      expect(typeof yamlOutput).toBe("string");
      expect(yamlOutput).toContain("songId: test_song_123");
      expect(yamlOutput).toContain(
        "text: A beautiful acoustic guitar on a porch",
      );
      expect(yamlOutput).toContain("filename: flux-schnell.webp");

      // Ensure it can be parsed back into an object safely
      const parsedBack = yaml.load(yamlOutput);
      expect(parsedBack).toEqual(metadata);
    });
  });

  describe("SongData ChordPro formatting", () => {
    it("should generate valid Custom ChordPro string without undefined fields", () => {
      // Arrange: Create a mock raw database row
      const mockDbRow = {
        id: "beatles-let-it-be",
        title: "Let It Be",
        artist: "The Beatles",
        chordpro: "[C]When I find myself in [G]times of trouble",
        createdAt: new Date(1708538216000), // Ensures `.getTime()` works
        updatedAt: new Date(1708538216000),
        language: "en",
        currentIllustration: {
          illustrationId: "ill_123",
          promptId: "prompt_456",
        },
      };

      const song = new SongData(mockDbRow as any);

      // Act
      const chordProOutput = song.toCustomChordpro();

      // Assert
      expect(chordProOutput).toContain("{title: Let It Be}");
      expect(chordProOutput).toContain("{artist: The Beatles}");
      expect(chordProOutput).toContain("{language: en}");
      expect(chordProOutput).toContain("{createdAt: 1708538216000}");
      expect(chordProOutput).toContain("{illustrationId: ill_123}");
      expect(chordProOutput).toContain("{promptId: prompt_456}");
      expect(chordProOutput).toContain(
        "[C]When I find myself in [G]times of trouble",
      );

      // Asserts that omitted keys (like tempo) don't output "undefined"
      expect(chordProOutput).not.toContain("undefined");
    });
  });
});
