import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock("idb-keyval", () => storage);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("persists the newest download after a failed refresh and clears it on confirmed removal", async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", {});
  storage.get.mockResolvedValue(undefined);
  const { queryClient, cacheRestored } = await import("./query-client");
  const { ApiException } = await import("../web/services/api-service");
  await cacheRestored;
  const key = ["song", "fetch", "song", "alt"];
  const older = { id: "song", versionId: "alt", versionRevision: 1, chordpro: "old sheet" };
  const newer = { ...older, versionRevision: 2, chordpro: "new sheet" };
  queryClient.setQueryData(key, older, { updatedAt: 123 });
  queryClient.setQueryData(["songbookEntries", "owner"], [{ song: older, capo: 2 }]);
  queryClient.setQueryData(["favorites", "viewer"], [{ song: newer }]);
  expect(queryClient.getQueryData(key)).toEqual(newer);
  expect(queryClient.getQueryState(key)?.dataUpdatedAt).toBe(123);
  expect(queryClient.getQueryData(["songbookEntries", "owner"])).toEqual([{ song: newer, capo: 2 }]);
  // Simulate a slower response completing after the newer songbook sync.
  queryClient.setQueryData(key, older);
  expect(queryClient.getQueryData(key)).toEqual(newer);

  async function restartAfter(error: Error) {
    await queryClient.fetchQuery({ queryKey: key, retry: false, staleTime: 0,
      queryFn: async () => { throw error; },
    }).catch(() => {});
    const persisted = storage.set.mock.calls.at(-1)![1].clientState;
    expect(JSON.stringify(persisted)).not.toContain("old sheet");
    const restored = new QueryClient();
    hydrate(restored, persisted);
    return restored.getQueryState(key);
  }
  expect(await restartAfter(new Error("Disconnected"))).toMatchObject({ status: "success", data: newer });
  expect(await restartAfter(new ApiException("Removed", 404))).toMatchObject({
    status: "error", data: undefined, error: { status: 404 },
  });
});

it.each(["v1", "v2"])("restores only the current persisted cache format (%s)", async (buster) => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("indexedDB", {});
  const seed = new QueryClient();
  seed.setQueryData(["songs"], [{ id: "downloaded-song" }]);
  storage.get.mockResolvedValue({ timestamp: Date.now(), buster, clientState: dehydrate(seed) });
  const { queryClient, cacheRestored } = await import("./query-client");
  await cacheRestored;
  if (buster === "v1") {
    expect(storage.del).toHaveBeenCalledWith("reactQuery");
    expect(queryClient.getQueryData(["songs"])).toBeUndefined();
  } else {
    expect(storage.del).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["songs"])).toEqual([{ id: "downloaded-song" }]);
  }
});
