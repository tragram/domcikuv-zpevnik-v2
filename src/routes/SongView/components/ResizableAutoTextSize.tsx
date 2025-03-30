import { useGesture } from '@use-gesture/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FitScreenMode, getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";
import React from 'react';
import { cn } from '@/lib/utils';

interface ResizableAutoTextSizeProps {
    children: React.ReactNode
    gestureContainerRef: React.RefObject<HTMLDivElement>
    className?: string
    autoColumns?: boolean
}

const INITIAL_FONT_SIZE = 16;

/**
 * Computes font size and optimal columns using a temporary offscreen clone
 */
function computeOptimalLayout(
    originalEl: HTMLElement,
    containerEl: HTMLElement,
    fitMode: FitScreenMode,
    minColumns: number = 1,
    maxColumns: number = 4,
    shouldOptimizeColumns: boolean = false
): { fontSize: number; columns: number } {
    // Create a clone for measurement to avoid any visual flickering
    const clone = originalEl.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    clone.style.width = 'auto';
    clone.style.height = 'auto';
    clone.style.fontSize = `${INITIAL_FONT_SIZE}px`;
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.ariaHidden = 'true';

    // Add to document for measurement
    document.body.appendChild(clone);

    const containerRect = containerEl.getBoundingClientRect();
    let bestFontSize = 0;
    let bestColumns = 1;

    try {
        if (shouldOptimizeColumns) {
            // Try different column counts
            for (let cols = minColumns; cols <= maxColumns; cols++) {
                const child = clone.querySelector('#song-content-wrapper');
                if (child) {
                    (child as HTMLElement).style.columnCount = `${cols}`;
                }
                clone.style.columnGap = '1em'; // TODO: this should be the same as on the real one

                // Get content size at reference font size
                const contentRect = clone.getBoundingClientRect();

                // Calculate font scaling factors
                let calculatedFontSize;

                if (fitMode === 'fitXY') {
                    const widthScale = containerRect.width / contentRect.width * INITIAL_FONT_SIZE;
                    const heightScale = containerRect.height / contentRect.height * INITIAL_FONT_SIZE;
                    calculatedFontSize = getFontSizeInRange(Math.min(widthScale, heightScale));
                } else if (fitMode === 'fitX') {
                    const widthScale = containerRect.width / contentRect.width * INITIAL_FONT_SIZE;
                    calculatedFontSize = getFontSizeInRange(widthScale);
                } else {
                    calculatedFontSize = INITIAL_FONT_SIZE; // Default for 'none'
                }
                console.log(cols, " cols: ", calculatedFontSize, "px")

                // Update if this configuration allows a larger font size
                if (calculatedFontSize > bestFontSize) {
                    bestFontSize = calculatedFontSize;
                    bestColumns = cols;
                } else {
                    // expect only one local maximum
                    break;
                }
            }
            console.log(bestFontSize, bestColumns)
        } else {
            // Just calculate font size for current column setting
            const contentRect = clone.getBoundingClientRect();

            if (fitMode === 'fitXY') {
                const widthScale = containerRect.width / contentRect.width * INITIAL_FONT_SIZE;
                const heightScale = containerRect.height / contentRect.height * INITIAL_FONT_SIZE;
                bestFontSize = getFontSizeInRange(Math.min(widthScale, heightScale));
            } else if (fitMode === 'fitX') {
                const widthScale = containerRect.width / contentRect.width * INITIAL_FONT_SIZE;
                bestFontSize = getFontSizeInRange(widthScale);
            }
        }
    } finally {
        // Always clean up the clone
        document.body.removeChild(clone);
    }

    return {
        fontSize: bestFontSize,
        columns: bestColumns
    };
}

export function ResizableAutoTextSize({
    children,
    gestureContainerRef,
    className,
}: ResizableAutoTextSizeProps) {
    const { layout, chords, actions } = useViewSettingsStore();
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [columnCount, setColumnCount] = useState(1);
    const [pinching, setPinching] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Combine classes
    const classNames = cn(
        className,
        'max-w-screen dark:text-white/95',
        chords.inlineChords ? 'chords-inline' : '',
        chords.showChords ? '' : 'chords-hidden',
        `fit-screen-${layout.fitScreenMode}`,
        layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
        // Only add column class if not using autoColumns
        (layout.multiColumns) ? 'song-content-columns' : '',
    );

    // Function to measure and update layout
    const updateLayout = useCallback(() => {
        if (!containerRef.current || !contentRef.current || pinching || layout.fitScreenMode === 'none') {
            if (layout.fitScreenMode === 'none') {
                setFontSize(layout.fontSize);
                setColumnCount(layout.multiColumns ? 2 : 1); // TODO: this should probably respect previously selected col #..?
            }
            return;
        }

        // Calculate optimal layout using the clone technique
        const { fontSize: newFontSize, columns: newColumnCount } = computeOptimalLayout(
            contentRef.current,
            containerRef.current,
            layout.fitScreenMode,
            1, // TODO: this should be in settings
            4,
            layout.multiColumns
        );

        setFontSize(newFontSize);
        if (layout.multiColumns) {
            setColumnCount(newColumnCount);
        } else {
            setColumnCount(1);
        }
    }, [layout.fitScreenMode, layout.fontSize, layout.multiColumns, pinching]);

    // Initial setup and resize observer
    useLayoutEffect(() => {
        if (!containerRef.current || !contentRef.current) return;

        if (!isInitialized) {
            // Hide content until first measurement is done
            contentRef.current.style.visibility = 'hidden';
        }

        updateLayout();

        if (!isInitialized) {
            // Show content after first measurement
            if (contentRef.current) {
                contentRef.current.style.visibility = 'visible';
                setIsInitialized(true);
            }
        }

        // Set up resize observer for subsequent updates
        if (layout.fitScreenMode !== 'none') {
            resizeObserverRef.current = new ResizeObserver(() => {
                if (contentRef.current && isInitialized) {
                    // For resize events, we don't hide the content
                    // as that would cause flickering
                    updateLayout();
                }
            });

            resizeObserverRef.current.observe(containerRef.current);
        }

        return () => {
            resizeObserverRef.current?.disconnect();
        };
    }, [layout.fitScreenMode, isInitialized, updateLayout]);

    // Update when dependencies change
    useLayoutEffect(() => {
        if (isInitialized) {
            updateLayout();
        }
    }, [
        layout.fitScreenMode,
        layout.multiColumns,
        layout.repeatParts,
        layout.repeatPartsChords,
        chords.inlineChords,
        chords.showChords,
        isInitialized,
        updateLayout
    ]);

    // Sync fontSize with layout when not pinching
    useEffect(() => {
        if (!pinching && layout.fitScreenMode === 'none') {
            setFontSize(layout.fontSize);
        }
    }, [layout.fontSize, layout.fitScreenMode, pinching]);

    // Handle pinch gestures
    useGesture({
        onPinchStart: () => {
            actions.setLayoutSettings({ fitScreenMode: "none" });
            setPinching(true);
        },
        onPinchEnd: () => {
            actions.setLayoutSettings({ fontSize });
            setPinching(false);
        },
        onPinch: ({ movement: [dScale], memo }) => {
            if (!memo) memo = fontSize;
            const newFontSize = getFontSizeInRange(memo * dScale);
            setFontSize(newFontSize);
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
                    classNames,
                    !isInitialized ? "invisible" : "visible",
                    layout.fitScreenMode === "none" ? "fit-screen-none" : "",
                    // TODO: this is dumb but I cannot come up with anything simple that's more elegant...
                    columnCount == 2 ? `[&>*]:columns-2` : "",
                    columnCount == 3 ? `[&>*]:columns-3` : "",
                    columnCount == 4 ? `[&>*]:columns-4` : "",
                )}
                style={{
                    fontSize: `${fontSize}px`,
                }}
            >
                {children}
            </div>
        </div>
    );
}

export default ResizableAutoTextSize;