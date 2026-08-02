import { describe, expect, it } from "vitest";

import { getWorkingVersion } from "./version-selection";

describe("getWorkingVersion", () => {
  it("uses the current version when one exists", () => {
    const versions = [
      { id: "pending", status: "pending" },
      { id: "current", status: "published" },
    ];

    expect(
      getWorkingVersion({ currentVersionId: "current" }, versions)?.id,
    ).toBe("current");
  });

  it("selects a pending version for a song with no published version", () => {
    const versions = [{ id: "pending", status: "pending" }];

    expect(getWorkingVersion({ currentVersionId: null }, versions)?.id).toBe(
      "pending",
    );
  });

  it("falls back to a rejected version and returns undefined for an empty song", () => {
    expect(
      getWorkingVersion(
        { currentVersionId: null },
        [{ id: "rejected", status: "rejected" }],
      )?.id,
    ).toBe("rejected");
    expect(getWorkingVersion({ currentVersionId: null }, [])).toBeUndefined();
  });
});
