import { useEffect, useState } from "react";
import {
  analyzeSongLayoutPressure,
  createCanvasLayoutPressureMeasurer,
  type LayoutPressureTextMeasurer,
  type SongLayoutPressure,
} from "./song-width-metrics";

interface CachedPressure {
  chordpro: string;
  pressure: SongLayoutPressure;
}

export interface SongLayoutPressureSource {
  id: string;
  chordpro: string;
}

const pressureCache = new Map<string, CachedPressure>();
let sharedMeasurer: LayoutPressureTextMeasurer | null | undefined;

function getMeasurer() {
  if (sharedMeasurer === undefined) {
    sharedMeasurer = createCanvasLayoutPressureMeasurer();
  }
  return sharedMeasurer;
}

function scheduleWhenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(callback, { timeout: 500 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = setTimeout(callback, 0);
  return () => clearTimeout(timeoutId);
}

function getCachedPressure(versionId: string, chordpro: string) {
  const cached = pressureCache.get(versionId);
  return cached?.chordpro === chordpro ? cached.pressure : null;
}

function calculateAndCachePressure(
  versionId: string,
  chordpro: string,
  measurer: LayoutPressureTextMeasurer,
) {
  const cached = getCachedPressure(versionId, chordpro);
  if (cached) return cached;

  const pressure = analyzeSongLayoutPressure(chordpro, measurer);
  pressureCache.set(versionId, { chordpro, pressure });
  return pressure;
}

const EMPTY_PRESSURES = new Map<string, SongLayoutPressure>();

/**
 * Calculates every supplied working version in idle batches. The table uses
 * the completed map for sorting; visible badges can still resolve earlier from
 * the shared cache.
 */
export function useSongLayoutPressures(
  sources: readonly SongLayoutPressureSource[],
) {
  const [completed, setCompleted] = useState<{
    sources: readonly SongLayoutPressureSource[];
    pressures: Map<string, SongLayoutPressure>;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    let cancelScheduled: (() => void) | undefined;
    let sourceIndex = 0;
    const pressures = new Map<string, SongLayoutPressure>();

    const processBatch = () => {
      if (disposed) return;
      const measurer = getMeasurer();
      if (!measurer) return;

      const batchEnd = Math.min(sourceIndex + 50, sources.length);
      for (; sourceIndex < batchEnd; sourceIndex++) {
        const source = sources[sourceIndex];
        pressures.set(
          source.id,
          calculateAndCachePressure(source.id, source.chordpro, measurer),
        );
      }

      if (sourceIndex < sources.length) {
        cancelScheduled = scheduleWhenIdle(processBatch);
      } else {
        setCompleted({ sources, pressures });
      }
    };

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      if (!disposed) cancelScheduled = scheduleWhenIdle(processBatch);
    });

    return () => {
      disposed = true;
      cancelScheduled?.();
    };
  }, [sources]);

  return completed?.sources === sources
    ? completed.pressures
    : EMPTY_PRESSURES;
}

export function useSongLayoutPressure(versionId: string, chordpro: string) {
  const [calculation, setCalculation] = useState<{
    versionId: string;
    chordpro: string;
    pressure: SongLayoutPressure;
  } | null>(null);
  const pressure =
    getCachedPressure(versionId, chordpro) ??
    (calculation?.versionId === versionId && calculation.chordpro === chordpro
      ? calculation.pressure
      : null);

  useEffect(() => {
    if (getCachedPressure(versionId, chordpro)) return;
    let disposed = false;
    let cancelScheduled: (() => void) | undefined;

    const calculate = () => {
      if (disposed) return;
      const measurer = getMeasurer();
      if (!measurer) return;

      const result = calculateAndCachePressure(
        versionId,
        chordpro,
        measurer,
      );
      if (!disposed) {
        setCalculation({ versionId, chordpro, pressure: result });
      }
    };

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      if (!disposed) cancelScheduled = scheduleWhenIdle(calculate);
    });

    return () => {
      disposed = true;
      cancelScheduled?.();
    };
  }, [chordpro, versionId]);

  return pressure;
}
