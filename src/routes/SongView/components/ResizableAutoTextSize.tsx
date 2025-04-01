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
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const updateLayout = useCallback(() => {
    if (!contentRef.current || !containerRef.current) return;

    setOptimalColumnCount(
      contentRef.current,
      containerRef.current,
      layout
    );
    
    if (layout.fitScreenMode !== "none") {
      setFontSize(
        contentRef.current,
        containerRef.current,
        layout.fitScreenMode,
      );
    }
  }, [layout]);

  // Initialize ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    // Create a simple resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      if (!pinching) {
        updateLayout();
      }
    });

    // Start observing the container
    resizeObserverRef.current.observe(containerRef.current);

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
    <div
      className="relative flex h-full w-full max-w-full"
      ref={containerRef}
    >
      <div
        ref={contentRef}
        className={cn(
          className,
          'max-w-screen dark:text-white/95 h-fit',
          chords.inlineChords ? 'chords-inline' : '',
          chords.showChords ? '' : 'chords-hidden',
          `fit-screen-${layout.fitScreenMode}`,
          layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
          layout.fitScreenMode === "none" ? "fit-screen-none" : "",
        )}
        style={{
          fontSize: `${layout.fontSize}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default ResizableAutoTextSize;