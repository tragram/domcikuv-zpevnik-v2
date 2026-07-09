import { describe, expect, it } from "vitest";
import {
  computeAudience,
  isSocketAlive,
  resolveChainUpdate,
  sameMembers,
} from "./session-sync-logic";

describe("sameMembers", () => {
  it("is true for equal sets regardless of order", () => {
    expect(sameMembers(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("is false when lengths differ", () => {
    expect(sameMembers(["a", "b"], ["a"])).toBe(false);
  });

  it("is false when membership differs", () => {
    expect(sameMembers(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("isSocketAlive", () => {
  it("is alive within the stale window", () => {
    expect(isSocketAlive(1000, 1000 + 199_999, 200_000)).toBe(true);
  });

  it("is stale once the window has elapsed", () => {
    expect(isSocketAlive(1000, 1000 + 200_000, 200_000)).toBe(false);
  });
});

describe("computeAudience", () => {
  it("excludes master sockets", () => {
    const result = computeAudience([
      { isMaster: true, alive: true, clientId: "master" },
      { isMaster: false, alive: true, clientId: "follower" },
    ]);
    expect(result).toEqual(new Set(["follower"]));
  });

  it("excludes sockets that announced departure", () => {
    const result = computeAudience([
      { isMaster: false, alive: true, left: true, clientId: "gone" },
      { isMaster: false, alive: true, clientId: "here" },
    ]);
    expect(result).toEqual(new Set(["here"]));
  });

  it("excludes ghosts (not alive)", () => {
    const result = computeAudience([
      { isMaster: false, alive: false, clientId: "ghost" },
      { isMaster: false, alive: true, clientId: "here" },
    ]);
    expect(result).toEqual(new Set(["here"]));
  });

  it("counts a relaying follower's subtree by identity, not by count", () => {
    const result = computeAudience([
      {
        isMaster: false,
        alive: true,
        clientId: "relay",
        subtree: ["a", "b"],
      },
      { isMaster: false, alive: true, clientId: "a" },
    ]);
    // "a" is reachable both directly and through the relay's subtree, but
    // the audience is a Set, so it's only counted once.
    expect(result).toEqual(new Set(["relay", "a", "b"]));
  });

  it("collapses duplicate sockets sharing a clientId", () => {
    const result = computeAudience([
      { isMaster: false, alive: true, clientId: "tab-1" },
      { isMaster: false, alive: true, clientId: "tab-1" },
    ]);
    expect(result).toEqual(new Set(["tab-1"]));
  });
});

describe("resolveChainUpdate", () => {
  const baseInput = {
    masterId: "master-1",
    masterNickname: "Master",
    isFirstSong: false,
    wasRelaying: false,
    currentSongId: "song-a",
    currentVersionId: "v1",
    songId: "song-a",
    versionId: "v1",
  };

  it("falls back to a standalone chain of just the master", () => {
    const result = resolveChainUpdate(baseInput);
    expect(result.chainPath).toEqual(["master-1"]);
    expect(result.originatorNickname).toBe("Master");
  });

  it("uses the incoming chain and its originator nickname when relaying", () => {
    const result = resolveChainUpdate({
      ...baseInput,
      incomingChainPath: ["origin", "relay-1", "master-1"],
      incomingOriginatorNickname: "Origin Nick",
    });
    expect(result.chainPath).toEqual(["origin", "relay-1", "master-1"]);
    expect(result.originatorNickname).toBe("Origin Nick");
  });

  it("does not write to D1 when nothing changed and it's not the first song", () => {
    const result = resolveChainUpdate(baseInput);
    expect(result.shouldWriteToDb).toBe(false);
  });

  it("writes to D1 for the first song of a session", () => {
    const result = resolveChainUpdate({ ...baseInput, isFirstSong: true });
    expect(result.shouldWriteToDb).toBe(true);
  });

  it("writes to D1 when the song changed", () => {
    const result = resolveChainUpdate({ ...baseInput, songId: "song-b" });
    expect(result.shouldWriteToDb).toBe(true);
  });

  it("writes to D1 when returning from relaying, even with an unchanged song", () => {
    const result = resolveChainUpdate({ ...baseInput, wasRelaying: true });
    expect(result.shouldWriteToDb).toBe(true);
  });

  it("never writes to D1 for a relayed (non-first-party) update", () => {
    const result = resolveChainUpdate({
      ...baseInput,
      isFirstSong: true,
      songId: "song-b",
      isRelay: true,
    });
    expect(result.shouldWriteToDb).toBe(false);
  });

  it("never writes to D1 without a master id", () => {
    const result = resolveChainUpdate({
      ...baseInput,
      masterId: null,
      isFirstSong: true,
    });
    expect(result.shouldWriteToDb).toBe(false);
  });
});
