// src/components/ResizableAutoTextSize.tsx
import { useGesture } from "@use-gesture/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  getFontSizeInRange,
  useViewSettingsStore,
} from "../hooks/viewSettingsStore";
import React from "react";
import { cn } from "~/lib/utils";
import { setFontSize, setOptimalColumnCount } from "../utils/columnLayout";
import { getElementFontSize, setElementFontSize } from "../utils/fontSize";
import { chordSettingsClassNames } from "../settings/ChordSettingsMenu";
import { layoutSettingsClassNames } from "../settings/LayoutSettings";

interface ResizableAutoTextSizeProps {
  children: React.ReactNode;
  gestureContainerRef: React.RefObject<HTMLDivElement>;
  className?: string;
  autoColumns?: boolean;
}

export function ResizableAutoTextSize({
  children,
  gestureContainerRef,
  className,
}: ResizableAutoTextSizeProps) {
  const { layout, chords, actions } = useViewSettingsStore();

  const [pinching, setPinching] = useState(false);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const updateLayout = useCallback(() => {
    if (!contentRef.current || !wrapperRef.current) return;

    setOptimalColumnCount(contentRef.current, wrapperRef.current, layout);

    if (layout.fitScreenMode !== "none") {
      setFontSize(contentRef.current, wrapperRef.current, layout.fitScreenMode);
    }
  }, [layout, chords]);

  // Initialize ResizeObserver
  useEffect(() => {
    if (!wrapperRef.current) return;
    resizeObserverRef.current = new ResizeObserver(() => {
      if (!pinching) {
        updateLayout();
      }
    });
    resizeObserverRef.current.observe(wrapperRef.current);
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [updateLayout, pinching]);

  // Initial layout update
  useLayoutEffect(() => {
    updateLayout();
  }, [updateLayout]);

  // wheel handler
  useEffect(() => {
    const container = gestureContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only react if Ctrl is pressed (standard zoom behavior)
      if (e.ctrlKey) {
        e.preventDefault(); // Stop browser native zoom

        if (!contentRef.current) return;

        // 1. Get current concrete size
        const currentFontSize = getElementFontSize(contentRef.current);

        // 2. Determine direction (negative deltaY is scrolling UP/Away from user)
        // Adjust step size here (0.05 = 5% change per tick)
        const step = 0.2; 
        const direction = e.deltaY > 0 ? -1 : 1;
        
        // 3. Calculate new size directly
        const newFontSize = getFontSizeInRange(currentFontSize * (1 + (direction * step)));

        // 4. Update DOM immediately
        setElementFontSize(contentRef.current, newFontSize);
        
        // 5. Sync with store (optional: debouncing this might be better for perf, 
        // but setting it directly ensures state consistency)
        actions.setLayoutSettings({ fontSize: newFontSize, fitScreenMode: "none" });
      }
    };

    // { passive: false } is required to use e.preventDefault()
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [gestureContainerRef, actions]);


  // gesture handler
  useGesture(
    {
      onPinchStart: () => {
        actions.setLayoutSettings({ fitScreenMode: "none" });
        setPinching(true);
      },
      onPinchEnd: () => {
        if (contentRef.current) {
          actions.setLayoutSettings({
            fontSize: getElementFontSize(contentRef.current),
          });
        }
        setPinching(false);
      },
      // We filter out wheel events here so this ONLY handles touch gestures
      onPinch: ({ movement: [dScale], memo, event }) => {
        // If this somehow catches a wheel event, ignore it (handled by native listener above)
        if (event instanceof WheelEvent) return memo;

        const baseFontSize = memo || getElementFontSize(contentRef.current);
        const newFontSize = getFontSizeInRange(baseFontSize * dScale);

        if (contentRef.current) {
          setElementFontSize(contentRef.current, newFontSize);
        }

        return baseFontSize;
      },
    },
    {
      target: gestureContainerRef,
      eventOptions: { passive: true },
      pinch: {
        rubberband: true,
        // modifierKey: null ensures we don't accidentally conflict with ctrl+wheel
        modifierKey: null 
      },
    }
  );

  return (
    <div
      id="auto-text-size-wrapper"
      className={cn(
        "w-full z-10 lg:px-16 p-4 sm:p-8",
        layout.fitScreenMode == "fitXY" ? "h-full" : "h-fit ",
        layout.fitScreenMode !== "fitXY" ? "mb-10" : ""
      )}
    >
      <div className="flex h-full w-full justify-center" ref={wrapperRef}>
        <div
          ref={contentRef}
          id="content-wrapper"
          className={cn(
            className,
            chordSettingsClassNames(chords),
            layoutSettingsClassNames(layout),
            "dark:text-white/95 h-fit max-w-full"
          )}
          style={{
            fontSize: `${layout.fontSize}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default ResizableAutoTextSize;