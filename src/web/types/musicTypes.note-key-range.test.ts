import { describe, it, expect } from "vitest";
import { Key, KeyMode, Note, SongRange } from "./musicTypes";

describe("Note.parse", () => {
  it("parses a bare natural note", () => {
    expect(Note.parse("C")?.toString()).toBe("C");
  });

  it("parses sharps and flats", () => {
    expect(Note.parse("C#")?.toString()).toBe("C#");
    expect(Note.parse("Db")?.toString("flat")).toBe("Db");
  });

  it("is case-insensitive on the letter", () => {
    expect(Note.parse("c")?.toString()).toBe("C");
  });

  it("returns undefined for an invalid note", () => {
    expect(Note.parse("Z")).toBeUndefined();
    expect(Note.parse("")).toBeUndefined();
  });

  it("rejects non-Czech letters (I) when czech=false", () => {
    // "H" is only valid in Czech notation; outside it, only A-G are accepted.
    expect(Note.parse("H", false)).toBeUndefined();
    expect(Note.parse("H", true)?.toString()).toBe("H");
  });
});

describe("Note transpose", () => {
  it("transposes up within the octave", () => {
    const c = new Note("C", "", true);
    expect(c.transposed(2).toString()).toBe("D");
  });

  it("wraps around the octave boundary", () => {
    const b = Note.parse("H", true)!; // Czech "H" = B natural
    expect(b.transposed(1).toString()).toBe("C");
  });

  it("wraps negative transposition", () => {
    const c = new Note("C", "", true);
    expect(c.transposed(-1).toString()).toBe("H");
  });

  it("transpose() mutates in place, transposed() returns a new Note", () => {
    const note = new Note("C", "", true);
    const other = note.transposed(2);
    expect(note.toString()).toBe("C");
    expect(other.toString()).toBe("D");

    note.transpose(2);
    expect(note.toString()).toBe("D");
  });
});

describe("Note.semitonesBetween", () => {
  it("computes the distance to a higher note", () => {
    const c = new Note("C", "", true);
    const g = new Note("G", "", true);
    expect(c.semitonesBetween(g)).toBe(7);
  });

  it("wraps around when the 'higher' note is actually lower", () => {
    const g = new Note("G", "", true);
    const c = new Note("C", "", true);
    expect(g.semitonesBetween(c)).toBe(5);
  });
});

describe("Key.parse", () => {
  it("parses a major key", () => {
    const key = Key.parse("C");
    expect(key?.mode).toBe(KeyMode.Major);
    expect(key?.toString()).toBe("C");
  });

  it("parses a minor key ('m' and 'mi' suffixes)", () => {
    expect(Key.parse("Am")?.mode).toBe(KeyMode.Minor);
    expect(Key.parse("Ami")?.mode).toBe(KeyMode.Minor);
  });

  it("returns undefined for null/empty input", () => {
    expect(Key.parse(null)).toBeUndefined();
    expect(Key.parse("")).toBeUndefined();
  });

  it("returns undefined for garbage input", () => {
    expect(Key.parse("not a key")).toBeUndefined();
  });
});

describe("Key.transposed / equals / isFlat", () => {
  it("transposes the underlying note but keeps the mode", () => {
    const key = Key.parse("Am")!;
    const transposed = key.transposed(2);
    expect(transposed.mode).toBe(KeyMode.Minor);
    expect(transposed.note.toString()).toBe("H");
  });

  it("equals compares by rendered string", () => {
    const a = Key.parse("C")!;
    const b = Key.parse("C")!;
    const c = Key.parse("Cm")!;
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("isFlat reports known flat keys", () => {
    expect(Key.parse("F")!.isFlat()).toBe(true);
    expect(Key.parse("C")!.isFlat()).toBe(false);
  });

  it("clone produces an independent copy", () => {
    const key = Key.parse("C")!;
    const cloned = key.clone();
    // Mutate the original's note (not the clone's — a note produced via
    // clone()/fromValue() has a read-only value and can't be transpose()'d
    // in place, only transposed()).
    key.note.transpose(2);
    expect(key.note.toString()).toBe("D");
    expect(cloned.note.toString()).toBe("C");
  });
});

describe("SongRange", () => {
  it("parses a simple range and computes semitones", () => {
    const range = new SongRange("c1-c2");
    expect(range.min?.toString()).toBe("C");
    expect(range.max?.toString()).toBe("C");
    expect(range.semitones).toBe(12);
  });

  it("parses a sub-octave range", () => {
    const range = new SongRange("c1-g1");
    expect(range.semitones).toBe(7);
  });

  it("logs and leaves fields undefined for an unparsable range", () => {
    const range = new SongRange("not a range");
    expect(range.min).toBeUndefined();
    expect(range.max).toBeUndefined();
    expect(range.semitones).toBeUndefined();
  });

  it("toString renders the lowercase note-octave range", () => {
    const range = new SongRange("c1-g1");
    expect(range.toString()).toBe("c1-g1");
  });

  it("toString returns an empty string when unparsable", () => {
    const range = new SongRange("garbage");
    expect(range.toString()).toBe("");
  });

  it("transposed shifts both endpoints", () => {
    const range = new SongRange("c1-g1");
    const transposed = range.transposed(2);
    expect(transposed.min?.toString()).toBe("D");
    expect(transposed.max?.toString()).toBe("A");
  });

  it("transposed(0) returns the same instance", () => {
    const range = new SongRange("c1-g1");
    expect(range.transposed(0)).toBe(range);
  });

  it("clone produces an independent equal copy", () => {
    const range = new SongRange("c1-g1");
    const cloned = range.clone();
    expect(cloned.toString()).toBe(range.toString());
    expect(cloned).not.toBe(range);
  });
});
