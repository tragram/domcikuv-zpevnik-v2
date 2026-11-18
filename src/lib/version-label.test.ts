import { expect, it } from "vitest";
import { versionLabel, versionBadgeLabel } from "./version-label";

it("uses explicit names, then source IDs, official status, and numbered alternatives", () => {
  expect(versionLabel({ label: "Acoustic", isOfficial: true })).toBe("Acoustic");
  expect(versionLabel({ importSourceId: "cifraclub", isOfficial: true })).toBe("cifraclub");
  expect(versionLabel({ isOfficial: true })).toBe("Official version");
  expect(versionLabel({ isCurrent: true })).toBe("Official version");
  expect(versionLabel({ versionNumber: 2 })).toBe("Version 2");
});

it("always calls the official badge Official, regardless of name or import source", () => {
  expect(versionBadgeLabel({ label: "Acoustic", isOfficial: true })).toBe("Official");
  expect(versionBadgeLabel({ importSourceId: "cifraclub", isCurrent: true })).toBe("Official");
  expect(versionBadgeLabel({ label: "Acoustic" })).toBe("Acoustic");
});
