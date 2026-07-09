import { describe, expect, it } from "vitest";
import { formatChord } from "./chordNotation";

describe("formatChord", () => {
  it("returns an empty string for falsy input", () => {
    expect(formatChord("")).toBe("");
  });

  it("restores sus to sus4, but leaves sus2 alone (each superscripted separately)", () => {
    expect(formatChord("Asus")).toBe("A<sup>sus</sup><sup>4</sup>");
    expect(formatChord("Asus2")).toBe("A<sup>sus</sup><sup>2</sup>");
  });

  it("restores ma7 to maj7 (each superscripted separately)", () => {
    expect(formatChord("Cma7")).toBe("C<sup>maj</sup><sup>7</sup>");
  });

  it("converts flat/sharp ASCII symbols to typographic ones", () => {
    expect(formatChord("Bb")).toBe('B<sup>♭</sup>');
    expect(formatChord("C#")).toBe('C<sup>♯</sup>');
  });

  it("superscripts numeric and other chord modifiers", () => {
    expect(formatChord("C7")).toBe('C<sup>7</sup>');
    expect(formatChord("Cdim")).toBe('C<sup>dim</sup>');
    expect(formatChord("C(add9)")).toBe('C<sup>(add9)</sup>');
  });

  it("leaves a bare major chord unmodified", () => {
    expect(formatChord("D")).toBe("D");
  });
});
