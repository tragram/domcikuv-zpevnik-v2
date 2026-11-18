// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useIsOnline } from "~/hooks/use-is-online";
import type { FeedStatus } from "../hooks/useSessionSync";
import { FeedStatusBar } from "./FeedStatusBar";

vi.mock("~/hooks/use-is-online", () => ({ useIsOnline: vi.fn(() => true) }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(useIsOnline).mockReturnValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const follower: FeedStatus = {
  enabled: true, isMaster: false, isConnected: true, connectionStatus: "connected",
  connectedClients: undefined, retryAttempt: 0,
  sessionState: { songId: "song", versionId: "version", versionRevision: 1, transposeSteps: 0, masterAvatar: null,
    masterNickname: "Domcik", masterId: "host", isMasterConnected: true,
    chainPath: [], originatorNickname: null },
};

async function render(status: FeedStatus) {
  await act(async () => root.render(<FeedStatusBar feedStatus={status} />));
  return container.querySelector('[role="status"]');
}

it("shows the follower's status without a master-only audience count", async () => {
  const bar = await render(follower);
  expect(bar?.textContent).toContain("Following Domcik's feed");
  expect(bar?.classList.contains("opacity-0")).toBe(false);
  expect(bar?.textContent).not.toContain("connected");
});

it.each([
  ["connecting", "Connecting to feed"],
  ["reconnecting", "reconnecting"],
  ["disconnected", "Disconnected"],
] as const)("shows %s for a follower without a count", async (connectionStatus, text) => {
  const bar = await render({ ...follower, connectionStatus });
  expect(bar?.textContent).toContain(text);
  expect(bar?.classList.contains("opacity-0")).toBe(false);
});

it("shows offline and stopped-host states without a count", async () => {
  vi.mocked(useIsOnline).mockReturnValue(false);
  expect((await render(follower))?.textContent).toContain("Offline");
  vi.mocked(useIsOnline).mockReturnValue(true);
  expect((await render({ ...follower, sessionState: { ...follower.sessionState!, isMasterConnected: false } }))?.textContent)
    .toContain("Domcik has stopped sharing");
});

it("shows the master's sharing status while the first count is pending", async () => {
  expect((await render({ ...follower, isMaster: true }))?.textContent).toBe("Sharing session");
});

it("renders nothing when sync is disabled", async () => {
  expect(await render({ ...follower, enabled: false })).toBeNull();
});
