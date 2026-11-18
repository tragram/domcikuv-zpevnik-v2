import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { retirementWorker, retireServiceWorker } from "./retire-service-worker";

it("only runs as a development-server plugin", () => {
  expect(retireServiceWorker().apply).toBe("serve");
});

it("retires the worker and reopens its tabs without touching cached user data", async () => {
  const handlers: Record<string, (event: { waitUntil(promise: Promise<unknown>): void }) => void> = {};
  const navigate = vi.fn(async () => {});
  const unregister = vi.fn(async () => true);
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  runInNewContext(retirementWorker, { self: {
    addEventListener: (type: string, handler: typeof handlers[string]) => { handlers[type] = handler; },
    skipWaiting,
    registration: { unregister },
    clients: { claim, matchAll: async () => [{ url: "https://dev.test/song/example", navigate }] },
  } });
  let pending: Promise<unknown> = Promise.resolve();
  const event = { waitUntil(promise: Promise<unknown>) { pending = promise; } };
  handlers.install(event);
  await pending;
  expect(skipWaiting).toHaveBeenCalledOnce();
  handlers.activate(event);
  await pending;
  expect(claim).toHaveBeenCalledOnce();
  expect(unregister).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith("https://dev.test/song/example");
});
