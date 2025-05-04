// src/components/ResizableAutoTextSize.tsx
import { useGesture } from '@use-gesture/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";
import React from 'react';
import { cn } from '@/lib/utils';
import { setFontSize, setOptimalColumnCount } from '../utils/columnLayout';
import { getElementFontSize, setElementFontSize } from '../utils/fontSize';

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

  // States that need to trigger re-renders
  const [pinching, setPinching] = useState(false);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const updateLayout = useCallback(() => {
    if (!contentRef.current || !wrapperRef.current) return;

    setOptimalColumnCount(
      contentRef.current,
      wrapperRef.current,
      layout
    );

    if (layout.fitScreenMode !== "none") {
      setFontSize(
        contentRef.current,
        wrapperRef.current,
        layout.fitScreenMode,
      );
    }
  }, [layout, chords]);

  // Initialize ResizeObserver
  useEffect(() => {
    if (!wrapperRef.current) return;

    // Create a simple resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      if (!pinching) {
        updateLayout();
      }
    });

    // Start observing the container
    resizeObserverRef.current.observe(wrapperRef.current);

    // Cleanup function
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

  // Handle pinch gestures
  useGesture({
    onPinchStart: () => {
      actions.setLayoutSettings({ fitScreenMode: "none" });
      setPinching(true);
    },
    onPinchEnd: () => {
      actions.setLayoutSettings({ fontSize: getElementFontSize(contentRef.current) });
      setPinching(false);
    },
    onPinch: ({ movement: [dScale], memo }) => {
      if (!memo) memo = getElementFontSize(contentRef.current);
      const newFontSize = getFontSizeInRange(memo * dScale);
      if (contentRef.current) {
        setElementFontSize(contentRef.current, newFontSize);
      }
      return memo;
    },
  }, {
    target: gestureContainerRef,
    eventOptions: { passive: true },
  });

  return (
    <div id="auto-text-size-wrapper" className={cn('w-full z-10 lg:px-16 p-4 sm:p-8', layout.fitScreenMode == "fitXY" ? "h-full" : "h-fit ", layout.fitScreenMode !== "fitXY" ? "mb-10" : "")}
    >
      <div className='flex h-full w-full justify-center' ref={wrapperRef}>
        {/* this "extra" div is here so that the target width & height can be found easily (otherwise, the padding of auto-text-size-wrapper makes it difficult) */}
        <div
          ref={contentRef}
          id="content-wrapper"
          className={cn(
            className,
            'dark:text-white/95 h-fit max-w-full',
            chords.inlineChords ? 'chords-inline' : '',
            chords.showChords ? '' : 'chords-hidden',
            layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
            layout.repeatParts ? 'repeated-parts-shown' : 'repeated-parts-hidden',
            `fit-screen-${layout.fitScreenMode}`,
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