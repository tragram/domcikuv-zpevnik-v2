import { describe, expect, it } from "vitest";
import { mod12, soundingKeyToSteps } from "./songTransposeMath";

describe("mod12", () => {
  it("passes through values already in range", () => {
    expect(mod12(0)).toBe(0);
    expect(mod12(11)).toBe(11);
  });

  it("wraps positive overflow", () => {
    expect(mod12(12)).toBe(0);
    expect(mod12(13)).toBe(1);
    expect(mod12(25)).toBe(1);
  });

  it("wraps negative values into 0..11", () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(-12)).toBe(0);
    expect(mod12(-13)).toBe(11);
  });
});

describe("soundingKeyToSteps", () => {
  it("returns 0 when the target is already the sounding key", () => {
    // originalKeyIndex 0 (C), no transpose yet, target is still C (0)
    expect(soundingKeyToSteps(0, 0, 0)).toBe(0);
  });

  it("computes the steps needed from an untransposed song", () => {
    // C (0) -> D (2) is +2 steps
    expect(soundingKeyToSteps(0, 0, 2)).toBe(2);
  });

  it("accounts for an already-applied transpose", () => {
    // Song originally in C, already transposed +2 (sounding D). Asking for
    // sounding E (4) should add 2 more steps on top of the existing 2.
    expect(soundingKeyToSteps(0, 2, 4)).toBe(4);
  });

  it("returns the raw difference, not the shortest wrap-around path", () => {
    // Song originally in B (11), no transpose (sounding B). Target C (0) is
    // reached by -11 steps here (not the equivalent +1) - the function picks
    // whichever offset keeps `originalKeyIndex + steps` closest to 0, not the
    // musically-shortest transpose distance.
    expect(soundingKeyToSteps(11, 0, 0)).toBe(-11);
  });

  it("is idempotent: applying the result reaches exactly the target", () => {
    const originalKeyIndex = 9; // A
    const currentSteps = -3;
    const targetIndex = 7; // G
    const steps = soundingKeyToSteps(originalKeyIndex, currentSteps, targetIndex);
    expect(mod12(originalKeyIndex + steps)).toBe(targetIndex);
  });
});
