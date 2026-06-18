import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionSync, FeedStatus, RelayStatus } from "./useSessionSync";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";

export interface UseMasterRelayOptions {
  /** The master whose feed this page is displaying. */
  targetNickname: string;
  /** The logged-in user's display nickname (used as their own DO URL). */
  ownNickname?: string;
  /** The logged-in user's DB id (used for loop detection). */
  ownMasterId?: string;
  /** Whether the user has sharing enabled (from useShareSessionToggle). */
  shareEnabled: boolean;
  /** Initial state fetched before mount. */
  initialState?: SessionSyncState;
}

/**
 * useMasterRelay
 *
 * Manages chained session following with loop detection and relay broadcasting.
 *
 * When `shareEnabled` is true and the user visits someone else's feed:
 *  - Opens an UPSTREAM WebSocket (follower → target's DO) to receive content.
 *  - Opens a DOWNSTREAM WebSocket (master → own DO) to relay that content.
 *  - Drops out of the discovery list by sending a null song (followers ignore
 *    null and keep the last song, so content is unaffected).
 *  - Reports its own audience (client ids) upstream (relay-subtree) so the
 *    target master's count includes the whole subtree behind this relay.
 *  - Detects cycles in the relay chain (chainPath includes ownMasterId) and
 *    cascades a loop-detected signal through the chain when found.
 *  - Automatically resumes relaying when a master resolves the loop.
 *
 * When `shareEnabled` is false (or the user is on their own feed) it behaves
 * exactly like a plain useSessionSync follower connection.
 *
 * Relay status is DERIVED from the upstream connection during render; effects
 * are used only for the genuine outward side-effects (relaying content,
 * notifying the chain of a loop, reporting the subtree count). This keeps a
 * single source of truth and avoids setState-in-effect cascades.
 */
export function useMasterRelay({
  targetNickname,
  ownNickname,
  ownMasterId,
  shareEnabled,
  initialState,
}: UseMasterRelayOptions) {
  const isSelf = !!ownNickname && ownNickname === targetNickname;

  // Relay is only active when the user is sharing AND is not on their own feed.
  const relayEnabled =
    shareEnabled && !!ownNickname && !!ownMasterId && !isSelf;

  // Dedupe the downstream relay broadcast: upstream syncs also fire on e.g.
  // isMasterConnected toggles, which must not re-broadcast identical content.
  const lastRelayedRef = useRef<string | null>(null);
  // Identity (chainPath JSON) of the loop we've already notified about, so a
  // reshaped loop re-fires the cascade but a steady one doesn't spam it.
  const loopKeyRef = useRef<string | null>(null);
  // True once the "hide from discovery" POST for this relay session has
  // resolved. We gate relaying on it so our own null doesn't wipe the content we
  // put on our DO (see the hide effect below).
  const [hideComplete, setHideComplete] = useState(false);

  // ─── Upstream: follow the target master as a regular follower ─────────────
  const { feedStatus: upstreamStatus, reportRelaySubtree } = useSessionSync({
    masterNickname: targetNickname,
    isMaster: false,
    enabled: true,
    initialState,
  });

  // ─── Downstream: broadcast relay content on own DO ────────────────────────
  const {
    feedStatus: downstreamStatus,
    updateSong: downstreamUpdateSong,
    notifyLoopDetected,
    audienceClients: downstreamAudience,
  } = useSessionSync({
    masterNickname: ownNickname,
    isMaster: true,
    enabled: relayEnabled,
  });

  // ─── Derived relay status (single source of truth) ────────────────────────
  const relayInfo: RelayStatus | undefined = useMemo(() => {
    if (!relayEnabled) return undefined;

    const state = upstreamStatus.sessionState;
    const chainPath = state?.chainPath ?? [];

    // PRIMARY loop: our own id is already in the chain coming from upstream —
    // relaying further would close a cycle.
    if (ownMasterId && chainPath.includes(ownMasterId)) {
      const fullLoop = [...chainPath, ownMasterId];
      return {
        active: false,
        loopDetected: true,
        chainPath: fullLoop,
        originatorNickname: state?.originatorNickname ?? null,
        loopSize: new Set(fullLoop).size,
      };
    }

    // CASCADE loop: a master elsewhere in the chain detected a loop and the
    // signal reached us over the upstream connection.
    const li = upstreamStatus.loopInfo;
    if (li?.detected) {
      return {
        active: false,
        loopDetected: true,
        chainPath: li.chainPath,
        originatorNickname: state?.originatorNickname ?? null,
        loopSize: li.loopSize,
      };
    }

    // Nothing to relay yet (no song / hidden via null) — relay is idle.
    if (!state?.songId) {
      return {
        active: false,
        loopDetected: false,
        chainPath: [],
        originatorNickname: null,
      };
    }

    // Normal relay: append our id; for a standalone upstream the upstream
    // master is the originator, otherwise its DO supplies originatorNickname.
    return {
      active: true,
      loopDetected: false,
      chainPath: [...chainPath, ownMasterId!],
      originatorNickname:
        state.originatorNickname ?? state.masterNickname ?? null,
    };
  }, [
    relayEnabled,
    upstreamStatus.sessionState,
    upstreamStatus.loopInfo,
    ownMasterId,
  ]);

  // ─── Hide from the discovery list when relay starts ───────────────────────
  // Send null as a normal stop: the DO nulls its state, writes D1 (removing us
  // from discovery) and broadcasts null — but followers ignore null and keep the
  // last song. We only relay AFTER this resolves (hideComplete) so the null
  // doesn't wipe the content we then put on our DO.
  useEffect(() => {
    if (!relayEnabled || !ownNickname) return;
    let active = true;
    fetch(`/api/session/${encodeURIComponent(ownNickname)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: null }),
    })
      .catch((err) =>
        console.error("[useMasterRelay] hide session failed:", err),
      )
      .finally(() => {
        if (active) setHideComplete(true);
      });
    return () => {
      active = false;
      setHideComplete(false); // re-gate the next relay session
    };
  }, [relayEnabled, ownNickname]);

  // Reset per-session dedupe refs whenever relay turns off.
  useEffect(() => {
    if (!relayEnabled) {
      lastRelayedRef.current = null;
      loopKeyRef.current = null;
    }
  }, [relayEnabled]);

  // ─── Side-effect: relay content downstream ────────────────────────────────
  const upstreamState = upstreamStatus.sessionState;
  useEffect(() => {
    if (!hideComplete || !relayInfo?.active || !upstreamState?.songId) return;
    const key = JSON.stringify([
      upstreamState.songId,
      upstreamState.versionId ?? null,
      upstreamState.transposeSteps ?? 0,
      relayInfo.chainPath,
      relayInfo.originatorNickname,
    ]);
    if (key === lastRelayedRef.current) return;
    lastRelayedRef.current = key;

    // isRelay:true skips the D1 write so relay content never pollutes the list.
    downstreamUpdateSong(
      upstreamState.songId,
      upstreamState.transposeSteps ?? 0,
      upstreamState.versionId ?? undefined,
      relayInfo.chainPath,
      relayInfo.originatorNickname ?? undefined,
      /* isRelay */ true,
    );
  }, [hideComplete, relayInfo, upstreamState, downstreamUpdateSong]);

  // ─── Side-effect: notify the chain of a loop ──────────────────────────────
  useEffect(() => {
    if (!relayInfo?.loopDetected) {
      loopKeyRef.current = null;
      return;
    }
    const key = JSON.stringify(relayInfo.chainPath);
    if (key === loopKeyRef.current) return;
    loopKeyRef.current = key;
    // Broadcast to own DO → cascades to any relay masters following us.
    notifyLoopDetected(relayInfo.chainPath);
  }, [relayInfo, notifyLoopDetected]);

  // ─── Side-effect: report our subtree (audience ids) upstream ──────────────
  //
  // Our own DO's audience is already transitive (it unions the subtrees reported
  // by our own relay-followers), so forwarding it propagates identities up the
  // chain. While a loop is flagged we report an empty set: a loop member's
  // subtree is broken (no content flows through a broken relay), so nobody is
  // watching through it — and an empty contribution keeps the chain's counts
  // settled at each member's true direct audience.
  useEffect(() => {
    reportRelaySubtree(
      !relayEnabled || relayInfo?.loopDetected ? [] : downstreamAudience,
    );
  }, [relayEnabled, downstreamAudience, relayInfo?.loopDetected, reportRelaySubtree]);

  // ─── Combined feedStatus ──────────────────────────────────────────────────
  //
  // The user is a follower of the target, so status is based on the upstream
  // connection, with connectedClients overridden to the user's OWN downstream
  // follower count while relaying, plus the derived relay block.
  const feedStatus: FeedStatus = {
    ...upstreamStatus,
    connectedClients: relayEnabled
      ? downstreamStatus.connectedClients
      : upstreamStatus.connectedClients,
    relay: relayInfo,
  };

  return { feedStatus };
}
