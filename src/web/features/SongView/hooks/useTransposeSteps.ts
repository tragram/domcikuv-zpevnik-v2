import { useCallback, useState } from "react";
import { FeedStatus } from "./useSessionSync";
import { useViewSettingsStore } from "./viewSettingsStore";

/**
 * Resolves the transposition shown for a song and the setter the UI calls.
 *
 * Two regimes:
 *  - Standalone / master: the value is the per-song transposition persisted in
 *    the settings store. Setting it just writes the store.
 *  - Follower (watching someone else's feed): the value tracks the master's
 *    broadcast transposition. The follower may still override it locally; the
 *    override holds until the master moves (changes song or broadcasts a new
 *    transposition), at which point we snap back to following the master.
 *
 * The follower override is `null` while we're tracking the master, so on join
 * the value resolves straight to the master's current transposition — there is
 * no flash of the follower's own stored value first.
 */
export function useTransposeSteps(
  songId: string,
  feedStatus?: FeedStatus,
): readonly [number, (steps: number) => void] {
  const storeTranspose = useViewSettingsStore(
    (state) => state.transpositions[songId] || 0,
  );
  const setStoreTranspose = useViewSettingsStore(
    (state) => state.actions.setTranspose,
  );

  const isFollower = !!feedStatus?.enabled && !feedStatus.isMaster;
  const masterSteps = feedStatus?.sessionState?.transposeSteps ?? null;

  // Local follower override; null means "follow the master".
  const [override, setOverride] = useState<number | null>(null);
  // The master broadcast we last reconciled against. When it moves we drop the
  // override so the follower snaps back to the master (setState-during-render is
  // the React-sanctioned way to adjust state when an input changes).
  const [synced, setSynced] = useState({ songId, steps: masterSteps });
  if (
    isFollower &&
    (synced.songId !== songId || synced.steps !== masterSteps)
  ) {
    setSynced({ songId, steps: masterSteps });
    setOverride(null);
  }

  const transposeSteps = isFollower
    ? (override ?? masterSteps ?? 0)
    : storeTranspose;

  const setTransposeSteps = useCallback(
    (steps: number) => {
      setStoreTranspose(songId, steps);
      if (isFollower) setOverride(steps);
    },
    [songId, isFollower, setStoreTranspose],
  );

  return [transposeSteps, setTransposeSteps] as const;
}
