import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import client from "src/worker/api-client";
import type { SongbookEntryApi } from "src/worker/api/api-types";

import { SongData } from "~/types/songData";
import { getIsOnline } from "~/hooks/use-is-online";
import {
  UserData,
  patchFavoriteEntry,
  useSongbookEntry,
} from "~/hooks/use-user-data";
import { FeedStatus } from "./useSessionSync";
import {
  SongTranspose,
  SongbookOverride,
  mod12,
  soundingKeyToSteps,
  useSongKeyBasis,
} from "./songTransposeMath";
import { useViewSettingsStore } from "./viewSettingsStore";

/**
 * Follower session sync: while watching someone else's feed the displayed
 * transpose tracks the master's broadcast. A local tweak overrides it until the
 * master moves (new song or new broadcast), then snaps back. `null` override
 * means "follow the master", so on join the value resolves straight to the
 * master's current transpose with no flash of our own stored value.
 */
function useFollowerSteps(songId: string, feedStatus?: FeedStatus) {
  const isFollower = !!feedStatus?.enabled && !feedStatus.isMaster;
  const masterSteps = feedStatus?.sessionState?.transposeSteps ?? null;

  const [override, setOverride] = useState<number | null>(null);
  // Drop the override whenever the master moves (setState-during-render is the
  // React-sanctioned way to adjust state when an input changes).
  const [synced, setSynced] = useState({ songId, steps: masterSteps });
  if (isFollower && (synced.songId !== songId || synced.steps !== masterSteps)) {
    setSynced({ songId, steps: masterSteps });
    setOverride(null);
  }

  return { isFollower, steps: override ?? masterSteps ?? 0, setOverride };
}

/**
 * The viewer's OWN resolved key/capo. The saved songbook value wins over the
 * local store (it may be newer, e.g. saved on another device); the store wins
 * over the song's original. This is what we persist and capture, so passively
 * following a master never overwrites it.
 */
function useOwnKeyCapo(
  songId: string,
  originalKeyIndex: number,
  originalCapo: number,
  entry: SongbookEntryApi | undefined,
) {
  // Per-song local overrides; `undefined` = the user hasn't touched this song.
  const storeTranspose = useViewSettingsStore((s) => s.transpositions[songId]);
  const storeCapo = useViewSettingsStore((s) => s.capos[songId]);

  // `?? undefined` normalizes the nullable DB column while keeping a saved 0.
  const savedKeyIndex = entry?.keyIndex ?? undefined;
  const savedTranspose =
    savedKeyIndex !== undefined
      ? mod12(savedKeyIndex - originalKeyIndex)
      : undefined;

  const transposeSteps = savedTranspose ?? storeTranspose ?? 0;
  const soundingKeyIndex = mod12(originalKeyIndex + transposeSteps);
  const capo = entry?.capo ?? storeCapo ?? originalCapo;

  return { transposeSteps, soundingKeyIndex, capo };
}

/**
 * Debounced auto-save of key/capo back to the songbook (own mode only), with an
 * optimistic cache write so favorites-first precedence updates instantly. A
 * no-op unless the song is liked — liking is the only gate, there's no save
 * button.
 */
function useAutoSaveKeyCapo(
  songId: string,
  userId: string | undefined,
  canPersist: boolean,
) {
  const queryClient = useQueryClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return useCallback(
    (keyIndex: number, capo: number) => {
      if (!canPersist) return;
      patchFavoriteEntry(queryClient, userId, songId, { keyIndex, capo });
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        client.api.favorites[":songId"]
          .$patch({ param: { songId }, json: { keyIndex, capo } })
          .catch(() => {
            // The value was already written to the persisted local cache above,
            // so offline it isn't actually lost — don't show a scary error.
            // Only surface a genuine online failure (probe-aware, since
            // navigator.onLine lies on a network with no real internet).
            if (getIsOnline()) toast.error("Couldn't save your key & capo");
          });
      }, 500);
    },
    [songId, userId, canPersist, queryClient],
  );
}

/**
 * The single source of a song's key/capo state in the song view. Two modes,
 * selected by `override`:
 *
 *  - OWN (no override): the viewer's own song. Composes saved-vs-store key/capo
 *    (`useOwnKeyCapo`), live follower sync (`useFollowerSteps`), and a debounced
 *    auto-save (`useAutoSaveKeyCapo`).
 *  - READ-ONLY (override set): viewing another user's songbook. Seeds from the
 *    owner's saved key/capo into local state; the viewer may tweak locally but
 *    nothing persists. The favorites query is disabled and auto-save never arms,
 *    so this path can't touch the viewer's store, cache, or server.
 */
export function useSongTranspose(
  songData: SongData,
  userData: UserData,
  feedStatus?: FeedStatus,
  override?: SongbookOverride,
): SongTranspose {
  const readOnly = !!override;
  const { effectiveKey, originalKeyIndex, originalCapo } =
    useSongKeyBasis(songData);

  // READ-ONLY local state: seeded from the owner's saved key/capo, re-seeded when
  // navigating songs. Declared always (rules of hooks); unused in own mode.
  const seedTranspose =
    override?.keyIndex != null ? mod12(override.keyIndex - originalKeyIndex) : 0;
  const seedCapo = override?.capo ?? originalCapo;
  const [roState, setRoState] = useState({
    songId: songData.id,
    transposeSteps: seedTranspose,
    capo: seedCapo,
  });
  if (readOnly && roState.songId !== songData.id) {
    setRoState({
      songId: songData.id,
      transposeSteps: seedTranspose,
      capo: seedCapo,
    });
  }

  // Saved personalization + favorite status from the live favorites cache.
  // Disabled in read-only (userId undefined) so it never touches the viewer's cache.
  const { entry, isFavorite } = useSongbookEntry(
    songData.id,
    readOnly ? undefined : userData?.profile.id,
    songData.isFavorite,
  );

  const own = useOwnKeyCapo(songData.id, originalKeyIndex, originalCapo, entry);
  const follower = useFollowerSteps(songData.id, feedStatus);
  const setStoreTranspose = useViewSettingsStore((s) => s.actions.setTranspose);
  const setStoreCapo = useViewSettingsStore((s) => s.actions.setCapo);

  const canPersist = !readOnly && !!userData && isFavorite;
  const autoSave = useAutoSaveKeyCapo(
    songData.id,
    userData?.profile.id,
    canPersist,
  );

  // What's actually rendered, per mode. A follower shows the master's broadcast;
  // everyone else (own mode) shows their own key; read-only shows local state.
  const ownSteps = follower.isFollower ? follower.steps : own.transposeSteps;
  const transposeSteps = readOnly ? roState.transposeSteps : ownSteps;
  const capo = readOnly ? roState.capo : own.capo;
  const soundingKeyIndex = mod12(originalKeyIndex + transposeSteps);
  // Liking captures the user's OWN key/capo, never a master's passively-shown one.
  const songbookPersonalization = {
    keyIndex: readOnly ? soundingKeyIndex : own.soundingKeyIndex,
    capo,
  };

  const setSoundingKeyIndex = (index: number) => {
    // `index` is the absolute key the user explicitly picked.
    if (readOnly) {
      setRoState((s) => ({
        ...s,
        transposeSteps: soundingKeyToSteps(
          originalKeyIndex,
          s.transposeSteps,
          index,
        ),
      }));
      return;
    }
    const steps = soundingKeyToSteps(originalKeyIndex, transposeSteps, index);
    setStoreTranspose(songData.id, steps);
    if (follower.isFollower) follower.setOverride(steps);
    autoSave(index, capo);
  };

  const setCapo = (newCapo: number) => {
    if (readOnly) {
      setRoState((s) => ({ ...s, capo: newCapo }));
      return;
    }
    setStoreCapo(songData.id, newCapo);
    // Persist against the user's OWN key (not the displayed master key) so a
    // follower's capo tweak can't clobber it.
    autoSave(own.soundingKeyIndex, newCapo);
  };

  return {
    effectiveKey,
    transposeSteps,
    capo,
    originalCapo,
    soundingKeyIndex,
    songbookPersonalization,
    setSoundingKeyIndex,
    setCapo,
  };
}
