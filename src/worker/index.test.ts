import { beforeEach, expect, it, vi } from "vitest";
import { route } from "./index";

const { getSession, handler } = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
  handler: vi.fn(async () => Response.json(null)),
}));

vi.mock("../lib/auth/server", () => ({ auth: () => ({ api: { getSession }, handler }) }));
vi.mock("./durable-objects/SessionSync", () => ({ SessionSync: class {} }));
vi.mock("./helpers/song-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./helpers/song-helpers")>()),
  retrieveSongs: async () => [],
  getSongbooks: async () => [],
}));

beforeEach(() => vi.clearAllMocks());

it("serves public catalog reads without looking up the visitor's session", async () => {
  const env = { DB: {}, KV: { get: async () => null } };
  const init = { headers: { cookie: "better-auth.session_token=example" } };
  expect((await route.request("/api/songs", init, env)).status).toBe(200);
  expect((await route.request("/api/songs/incremental?songDBVersion=v0:source-display&lastUpdateAt=2026-01-01", init, env)).status).toBe(200);
  expect((await route.request("/api/songs/songbooks", init, env)).status).toBe(200);
  expect(getSession).not.toHaveBeenCalled();
});

it("lets Better Auth handle its route directly and checks sessions for account data", async () => {
  const env = { DB: {} };
  expect((await route.request("/api/auth/get-session", undefined, env)).status).toBe(200);
  expect(handler).toHaveBeenCalledOnce();
  expect(getSession).not.toHaveBeenCalled();

  expect((await route.request("/api/favorites", undefined, env)).status).toBe(200);
  expect(getSession).toHaveBeenCalledOnce();
});
