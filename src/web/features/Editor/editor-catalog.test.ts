import { expect, it } from "vitest";
import { indexEditorCatalog } from "./editor-catalog";

const catalog = indexEditorCatalog([
  { id: "first", artist: "Čechomor", title: "Mezi horami" },
  { id: "cechomor-promeny", artist: "Čechomor", title: "Proměny" },
  { id: "third", artist: "Jaromír Nohavica a Čechomor", title: "Proměny" },
  { id: "fourth", artist: "Cechomor", title: "Promeny" },
]);

it("suggests distinct catalog names with accent-insensitive prefix and substring matching", () => {
  expect(catalog.suggestArtists("  CECHO")).toEqual([
    "Čechomor",
    "Jaromír Nohavica a Čechomor",
  ]);
  expect(catalog.suggestArtists("  ")).toEqual([]);
});

it("hides suggestions when the field already matches a catalog entry", () => {
  expect(catalog.suggestArtists("  CECHOMOR ")).toEqual([]);

  const titles = indexEditorCatalog([
    { id: "first", artist: "Čechomor", title: "Proměny" },
    { id: "second", artist: "Čechomor", title: "Proměny live" },
  ]);
  expect(titles.suggestTitles("Čechomor", "Proměn")).toEqual(["Proměny", "Proměny live"]);
  expect(titles.suggestTitles("Čechomor", "  PROMENY ")).toEqual([]);
  expect(titles.suggestTitles("Čechomor", "Proměny", "first")).toEqual([]);
});

it("suggests artists despite typos and prioritizes literal matches", () => {
  expect(catalog.suggestArtists("Cehcomor")[0]).toBe("Čechomor");
  expect(catalog.suggestArtists("xyz")).toEqual([]);

  const artists = indexEditorCatalog([
    { id: "beatles", artist: "The Beatles", title: "Yesterday" },
    { id: "beatls", artist: "Beatls Tribute", title: "Yesterday" },
  ]);
  expect(artists.suggestArtists("Beatls")).toEqual(["Beatls Tribute", "The Beatles"]);
});

it("requires both fields to match and excludes only the song being edited", () => {
  expect(catalog.findMatches("cechomor", " Mezi  Horami ").matches.map(({ id }) => id)).toEqual(["first"]);
  expect(catalog.findMatches("CECHOMOR", "Proměny").matches.map(({ id }) => id)).toEqual(["cechomor-promeny", "fourth"]);
  expect(catalog.findMatches("CECHOMOR", "Proměny", "cechomor-promeny").matches.map(({ id }) => id)).toEqual(["fourth"]);
  expect(catalog.findMatches("CECHOMOR", "Prom").matches).toEqual([]);
  expect(catalog.findMatches("CECHOMOR", "").matches).toEqual([]);
});

it("suggests an existing title for the entered artist despite typos or a version note", () => {
  expect(catalog.suggestTitles("CECHOMOR", "Porměny")).toEqual(["Proměny"]);
  expect(catalog.suggestTitles("Čechomor", "Proměny (live)")).toEqual(["Proměny"]);
  expect(catalog.suggestTitles("Jaromír Nohavica a Čechomor", "Mezi hora")).toEqual([]);
  expect(catalog.suggestTitles("Čechomor", "Proměny")).toEqual([]);
  expect(catalog.suggestTitles("Čechomor", "M")).toEqual([]);
  expect(catalog.suggestTitles("Čechomor", "Mezi hora", "first")).toEqual([]);
});

it("identifies the create endpoint's destination independently of metadata matches", () => {
  expect(catalog.findMatches("CECHOMOR", "Promeny").versionTarget?.id).toBe("cechomor-promeny");
  expect(catalog.findMatches("CECHOMOR", "Proměny...").matches.map(({ id }) => id)).toEqual(["cechomor-promeny"]);
  expect(catalog.findMatches("CECHOMOR", " Proměny ").versionTarget).toBeUndefined();
  expect(catalog.findMatches("CECHOMOR", "Proměny", "another-song").versionTarget).toBeUndefined();
});
