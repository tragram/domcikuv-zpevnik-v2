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

  // --------------------------------------------------------------------------
  // 1. Manual Wheel Handler (Handles Ctrl + Wheel for Zoom)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = gestureContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // If Ctrl is NOT pressed, we return early. 
      // This allows the event to bubble up and perform standard scrolling.
      if (!e.ctrlKey) return;

      // If Ctrl IS pressed, we handle the zoom and stop the browser zoom.
      e.preventDefault();

      if (!contentRef.current) return;

      const currentFontSize = getElementFontSize(contentRef.current);
      
      // Negative deltaY is scrolling UP/Away (Zoom In)
      const step = 0.2; 
      const direction = e.deltaY > 0 ? -1 : 1;
      
      const newFontSize = getFontSizeInRange(currentFontSize * (1 + (direction * step)));

      setElementFontSize(contentRef.current, newFontSize);
      actions.setLayoutSettings({ fontSize: newFontSize, fitScreenMode: "none" });
    };

    // { passive: false } allows us to call e.preventDefault()
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [gestureContainerRef, actions]);


  // --------------------------------------------------------------------------
  // 2. Gesture Handler (Handles Touch Pinch)
  // --------------------------------------------------------------------------
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
      onPinch: ({ movement: [dScale], memo, event }) => {
        // Double safety: If a wheel event somehow gets here, ignore it 
        // (your manual handler above takes care of it)
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