import { useMemo } from "react";

import { Key, Note } from "~/types/musicTypes";
import { SongData } from "~/types/songData";
import { guessKey } from "../utils/songRendering";

/** Wrap any integer into the 0..11 pitch-class range. */
export const mod12 = (n: number) => (((n % 12) + 12) % 12);

/**
 * A concrete key + capo for a song, captured into the songbook row when liking a
 * song. `keyIndex` is the absolute sounding key as a pitch class (0..11). `capo`
 * is a standalone note the user keeps for themselves — it never affects chord
 * spelling or the key (chords render from `transposeSteps` only).
 */
export type KeyCapo = { keyIndex: number; capo: number };

/**
 * A songbook owner's saved key/capo, nullable because either may be unset
 * (NULL in the DB = "no override, follow the song's original").
 */
export type SongbookOverride = { keyIndex: number | null; capo: number | null };

/**
 * Everything the song view needs to render and edit a song's key/capo. Returned
 * by `useSongTranspose` for both modes it handles — the viewer's own
 * (persistable) song and a read-only view of another user's saved key/capo — so
 * `SongView` can treat the two uniformly.
 */
export interface SongTranspose {
  /** Song's key (explicit or guessed); drives chord-name rendering. */
  effectiveKey: Key | undefined;
  /** The single offset driving chord rendering and broadcast over sessions. */
  transposeSteps: number;
  /** Standalone capo note (see `KeyCapo`): displayed and saved, nothing else. */
  capo: number;
  /** The song's own ("main") capo, used for the reset hint. */
  originalCapo: number;
  /** Current sounding key as a 0..11 pitch class — purely `originalKey + transpose`. */
  soundingKeyIndex: number;
  /** What liking the song captures into its songbook row. */
  songbookPersonalization: KeyCapo;
  /** Change the sounding key (transposes the chords). */
  setSoundingKeyIndex: (index: number) => void;
  /** Change the cosmetic capo note (affects nothing else). */
  setCapo: (capo: number) => void;
}

/**
 * The render-offset needed to reach `targetIndex` (a 0..11 sounding key) from
 * the current offset. Keeps the "pick a key" math in one place.
 */
export const soundingKeyToSteps = (
  originalKeyIndex: number,
  currentSteps: number,
  targetIndex: number,
) => currentSteps + (targetIndex - mod12(originalKeyIndex + currentSteps));

export interface SongKeyBasis {
  /** Song's key (explicit or guessed); drives chord-name rendering. */
  effectiveKey: Key | undefined;
  /** Semitone index (0..11 from C) of the song's original written-shapes key. */
  originalKeyIndex: number;
  /** The song's own ("main") capo, used for the reset hint. */
  originalCapo: number;
}

/**
 * The song's immutable key/capo basis: derived once from the song so the
 * key-math lives in exactly one place.
 */
export function useSongKeyBasis(songData: SongData): SongKeyBasis {
  const effectiveKey = useMemo(
    () => songData.key ?? guessKey(songData.chordpro),
    [songData.key, songData.chordpro],
  );
  const originalKeyIndex = useMemo(
    () =>
      effectiveKey?.note ? new Note("C").semitonesBetween(effectiveKey.note) : 0,
    [effectiveKey],
  );
  return { effectiveKey, originalKeyIndex, originalCapo: songData.capo ?? 0 };
}
