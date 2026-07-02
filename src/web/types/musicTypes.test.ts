import { describe, it, expect } from "vitest";
import { Key, KeyMode } from "./musicTypes";

describe("Key.parse minor suffixes", () => {
  // Regression: the Czech "mi" minor suffix used to be parsed as major because
  // the mode was compared with the exact string "m" (so "mi" fell through to
  // major). Both "m" and "mi" must yield a minor key.
  it("parses the Czech 'mi' suffix as minor", () => {
    for (const text of ["Ami", "Dmi", "Hmi", "C#mi"]) {
      const key = Key.parse(text, true);
      expect(key, text).toBeDefined();
      expect(key!.mode, text).toBe(KeyMode.Minor);
    }
  });

  it("still parses the 'm' suffix as minor", () => {
    for (const text of ["Am", "F#m", "Gm"]) {
      const key = Key.parse(text, true);
      expect(key!.mode, text).toBe(KeyMode.Minor);
    }
  });

  it("parses bare notes as major", () => {
    for (const text of ["A", "C#", "H"]) {
      const key = Key.parse(text, true);
      expect(key!.mode, text).toBe(KeyMode.Major);
    }
  });
});
