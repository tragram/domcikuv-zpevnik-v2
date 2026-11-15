import { describe, expect, it } from "vitest";
import type { SongData } from "~/types/songData";
import type { UserData } from "~/hooks/use-user-data";
import type { FeedStatus } from "../hooks/useSessionSync";
import { getVersionDetails } from "./versionDetails";

const official = { id: "song", versionId: "official", isCustom: false } as SongData;
const user = { profile: { id: "viewer" }, submissions: [] } as unknown as UserData;
const custom = {
  ...official,
  versionId: "custom",
  isCustom: true,
  customVersionAuthor: { id: "author", name: "Petr" },
} as SongData;

describe("song version details", () => {
  it("resolves missing cached status from the selected history row", () => {
    expect(getVersionDetails(official, user, undefined, undefined, "published").status)
      .toBe("Published");
    expect(getVersionDetails(custom, user, undefined, undefined, "archived"))
      .toMatchObject({ status: "Archived", notes: ["Older revision."] });
  });
  it("distinguishes a saved official revision from following official updates", () => {
    expect(getVersionDetails(official, user, { source: "saved" })).toMatchObject({
      label: "Official version",
      reason: "You saved this version in your songbook.",
    });
    expect(getVersionDetails(official, user, { source: "official" }).reason)
      .toBe("Showing the current official version of this song.");
  });

  it("keeps authorship separate from who selected the version in a session", () => {
    const following = {
      enabled: true,
      isMaster: false,
      sessionState: { masterNickname: "Anna" },
    } as FeedStatus;
    expect(getVersionDetails(custom, user, { source: "saved" }, following))
      .toMatchObject({
        author: "Petr",
        reason: "Following the version selected by Anna.",
        canChoose: false,
      });
  });

  it("keeps an unnamed host read-only", () => {
    const following = { enabled: true, isMaster: false } as FeedStatus;
    expect(getVersionDetails(custom, user, undefined, following))
      .toMatchObject({ canChoose: false });
  });

  it("keeps an unnamed songbook read-only and explains its fallback", () => {
    const details = getVersionDetails(official, user, {
      source: "songbook",
      unavailable: true,
    });
    expect(details.canChoose).toBe(false);
    expect(details.reason).toContain("could not be loaded");
    expect(details.notes).toContain("Saved version unavailable; showing official.");
  });

  it("does not claim an unavailable personal pin is the displayed revision", () => {
    expect(getVersionDetails(official, user, { source: "saved", unavailable: true }).reason)
      .toBe("Your saved version could not be loaded.");
  });

  it("explains explicit links without claiming a saved preference", () => {
    expect(getVersionDetails(custom, user, { source: "link" }).reason)
      .toBe("This link opens a specific version of the song.");
  });

  it("describes archived and pending versions accurately for other authors", () => {
    const archived = getVersionDetails({ ...custom, versionStatus: "archived" } as SongData, user);
    expect(archived.notes).toContain("Older revision.");
    expect(archived.notes.join(" ")).not.toContain("awaiting approval");
    const pending = getVersionDetails({ ...custom, versionStatus: "pending" } as SongData, user);
    expect(pending.notes.join(" ")).toContain("awaiting approval");
  });

  it("recognizes the viewer's authorship without attributing a foreign edit to them", () => {
    expect(getVersionDetails(custom, user).label).toBe("Custom version");
    expect(getVersionDetails({
      ...custom,
      customVersionAuthor: { id: "viewer", name: "Viewer" },
    } as SongData, user).label).toBe("Your version");
  });
});
