import { afterEach, describe, expect, it, vi } from "vitest";
import { song } from "../../src/lib/db/schema";

vi.mock("./env", () => ({ requireEnv: () => "test" }));
import { db } from "./remote-db";

afterEach(() => vi.unstubAllGlobals());

describe("remote D1 row decoding", () => {
  it("decodes both list and single-row results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      success: true, result: [{ success: true, results: [{ id: "song" }] }],
    })));
    expect(await db.select({ id: song.id }).from(song)).toEqual([{ id: "song" }]);
    expect(await db.select({ id: song.id }).from(song).get()).toEqual({ id: "song" });
  });

  it("returns undefined for a missing single row and rejects D1 errors", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, result: [{ success: true, results: [] }] }))
      .mockResolvedValueOnce(Response.json({ success: false, errors: [{ message: "Query failed" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await db.select({ id: song.id }).from(song).get()).toBeUndefined();
    await expect(db.select({ id: song.id }).from(song)).rejects.toMatchObject({ cause: expect.objectContaining({ message: expect.stringContaining("Query failed") }) });
  });
});
