// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSessionSync } from "./useSessionSync";

class TestSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CLOSING = 2;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  constructor(_url: string) { TestSocket.instances.push(this); }
  open() { this.readyState = TestSocket.OPEN; this.onopen?.(); }
  close() { this.readyState = TestSocket.CLOSED; this.onclose?.(); }
  receive(payload: object) { this.onmessage?.({ data: JSON.stringify(payload) }); }
}

let root: Root;
let result: ReturnType<typeof useSessionSync>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("WebSocket", TestSocket);
  TestSocket.instances = [];
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
async function mount(isMaster: boolean) {
  function Harness() {
    const session = useSessionSync({ masterNickname: "host", isMaster });
    useEffect(() => { result = session; }, [session]);
    return null;
  }
  await act(async () => root.render(<Harness />));
  const socket = TestSocket.instances.at(-1)!;
  await act(async () => socket.open());
  return socket;
}

it("broadcasts the displayed revision with the stable version ID", async () => {
  const socket = await mount(true);
  result.updateSong("song", 0, "version", { versionRevision: 2 });
  expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({
    type: "update-song", songId: "song", versionId: "version", versionRevision: 2,
  });
});

it("receives changed revisions and retains the last revision when sharing stops", async () => {
  const socket = await mount(false);
  const sync = { type: "sync", songId: "song", versionId: "version", versionRevision: 1,
    transposeSteps: 0, masterNickname: "host", masterAvatar: null, masterId: "host", chainPath: ["host"] };
  await act(async () => socket.receive(sync));
  expect(result.feedStatus.sessionState?.versionRevision).toBe(1);
  await act(async () => socket.receive({ ...sync, versionRevision: 2 }));
  expect(result.feedStatus.sessionState?.versionRevision).toBe(2);
  await act(async () => socket.receive({ ...sync, songId: null, versionId: null, versionRevision: null }));
  expect(result.feedStatus.sessionState).toMatchObject({ songId: "song", versionId: "version", versionRevision: 2 });
});

it("rejects a broadcast missing its required revision", async () => {
  const socket = await mount(false);
  await act(async () => socket.receive({ type: "sync", songId: "song", versionId: "version", transposeSteps: 0 }));
  expect(result.feedStatus.sessionState).toBeUndefined();
});
