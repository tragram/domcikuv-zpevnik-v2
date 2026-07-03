import { describe, it, expect } from "vitest";
import {
  isValidNickname,
  nicknameError,
  NICKNAME_MAX_LENGTH,
  NICKNAME_RULES_MESSAGE,
  NICKNAME_TOO_LONG_MESSAGE,
} from "./nickname";

describe("nicknameError", () => {
  it("rejects an empty nickname", () => {
    expect(nicknameError("")).toBe("Please enter a nickname");
  });

  it("rejects a nickname longer than the max length", () => {
    const tooLong = "a".repeat(NICKNAME_MAX_LENGTH + 1);
    expect(nicknameError(tooLong)).toBe(NICKNAME_TOO_LONG_MESSAGE);
  });

  it("accepts a nickname exactly at the max length", () => {
    const exact = "a".repeat(NICKNAME_MAX_LENGTH);
    expect(nicknameError(exact)).toBeNull();
  });

  it("accepts Unicode letters (e.g. accented names)", () => {
    expect(nicknameError("Žluťoučký")).toBeNull();
  });

  it("accepts the allowed separators . _ -", () => {
    expect(nicknameError("a.b_c-d")).toBeNull();
  });

  it("rejects whitespace and URL-unsafe characters", () => {
    for (const bad of ["a b", "a/b", "a?b", "a#b", "a%b", "a@b"]) {
      expect(nicknameError(bad), bad).toBe(NICKNAME_RULES_MESSAGE);
    }
  });
});

describe("isValidNickname", () => {
  it("mirrors nicknameError", () => {
    expect(isValidNickname("valid_name")).toBe(true);
    expect(isValidNickname("")).toBe(false);
    expect(isValidNickname("bad name")).toBe(false);
  });
});
