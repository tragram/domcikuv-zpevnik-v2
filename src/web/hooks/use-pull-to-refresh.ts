import { useDrag } from "@use-gesture/react";
import { useRef, useState } from "react";

// Dampened px of pull needed to trigger a refresh on release.
const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
// Finger movement is dampened so the indicator lags the touch like native PTR.
const DAMPENING = 0.4;

export type PullToRefreshState = {
  // Dampened pull distance in px (0 while idle) — drive the indicator with it.
  pullDistance: number;
  // The pull has passed the threshold; releasing now will refresh.
  isReady: boolean;
  // `onRefresh` is running after a successful pull.
  isRefreshing: boolean;
};

/**
 * Window-level pull-to-refresh for touch devices. The gesture only arms when
 * it starts with the page scrolled to the very top; while pulling, touchmove
 * is preventDefault-ed so the browser's own pull-to-refresh can't fire on top
 * of ours.
 */
export function usePullToRefresh(
  onRefresh: () => Promise<unknown>,
  enabled: boolean,
): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // State mirror for the gesture handler (state itself would be a re-render
  // behind).
  const refreshingRef = useRef(false);

  useDrag(
    ({ first, active, canceled, movement: [, my], event, memo }) => {
      // Arm only when the drag begins at the very top while idle; scrollY can
      // be negative while iOS rubber-bands. The armed flag travels via `memo`.
      let armed: boolean = first
        ? window.scrollY <= 0 && !refreshingRef.current
        : (memo as boolean);

      // Finger went up or the page started scrolling: this is a scroll, not a
      // pull — disarm for the rest of the gesture.
      if (armed && (my < 0 || window.scrollY > 0)) {
        armed = false;
        setPullDistance(0);
      }
      if (!armed) return false;

      const distance = Math.min(MAX_PULL, my * DAMPENING);

      if (active) {
        // Stop the browser's own pull-to-refresh / rubber-banding.
        if (event.cancelable) event.preventDefault();
        setPullDistance(distance);
        return true;
      }

      // Released (or cancelled).
      setPullDistance(0);
      if (!canceled && distance >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setIsRefreshing(true);
        onRefresh().finally(() => {
          refreshingRef.current = false;
          setIsRefreshing(false);
        });
      }
      return false;
    },
    {
      target: typeof window === "undefined" ? undefined : window,
      enabled,
      // Ignore mostly-horizontal swipes; desktop has the toolbar button, so
      // the gesture listens to touch only.
      axis: "y",
      pointer: { touch: true },
      // Non-passive so preventDefault actually works on touchmove.
      eventOptions: { passive: false },
    },
  );

  return {
    pullDistance,
    isReady: pullDistance >= PULL_THRESHOLD,
    isRefreshing,
  };
}
