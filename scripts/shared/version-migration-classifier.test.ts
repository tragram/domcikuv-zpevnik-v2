import { expect, it } from "vitest";
import { classifyVersionMigration, migrationLyrics } from "./version-migration-classifier";

it("treats transposition and chord placement as revisions without splitting words", () => {
  expect(migrationLyrics("ve[C]čer")).toEqual(["vecer"]);
  expect(classifyVersionMigration("[D]Večer [A]přijde", "[G]Večer přij[C]de").decision).toBe("revision");
});

it("ignores musical tabs when comparing lyrics", () => {
  expect(classifyVersionMigration("Hello world", "{start_of_tab}\n--0-2-3--\n{end_of_tab}\nHello world").decision).toBe("revision");
});

it("flags different lyrics even when the stored song identity matches", () => {
  expect(classifyVersionMigration("Lásko má noc už odchází", "Já ač mám spánek bezesný").decision).toBe("review");
});

it("flags a major chorus rewrite despite repeated lyrics matching", () => {
  const chorus = "This is the same chorus with enough words to sing together";
  const before = `${chorus}\n${chorus}\n${chorus}`;
  const after = `${chorus}\n{chorus}\n{chorus}`;
  expect(classifyVersionMigration(before, after)).toMatchObject({ decision: "review", reason: "Large chorus/repeat restructuring" });
});
