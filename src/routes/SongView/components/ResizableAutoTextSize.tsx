import { useGesture } from '@use-gesture/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FitScreenMode, getFontSizeInRange, LayoutSettings, useViewSettingsStore } from "../hooks/viewSettingsStore";
import React from 'react';
import { cn } from '@/lib/utils';

interface ResizableAutoTextSizeProps {
    children: React.ReactNode
    gestureContainerRef: React.RefObject<HTMLDivElement>
    className?: string
    autoColumns?: boolean
}

const INITIAL_FONT_SIZE = 16;
// Define a consistent column gap value to use both in calculations and styling
const COLUMN_GAP = '1em';
const COLUMN_GAP_PX = 16; // Approximate pixel equivalent of 1em
const HIGHER_COL_RATIO = 1.1; // How many times larger font size needs to be in more columns to justify the switch

/**
 * Calculates font size based on content dimensions and container dimensions
 */
function calculateFontSize(
    contentRect: DOMRect,
    containerRect: DOMRect,
    fitMode: FitScreenMode
): number {
    if (fitMode === 'fitXY') {
        const widthScale = containerRect.width / contentRect.width * INITIAL_FONT_SIZE;
        const heightScale = containerRect.height / contentRect.height * INITIAL_FONT_SIZE;
        return getFontSizeInRange(Math.min(widthScale, heightScale));
    } else if (fitMode === 'fitX') {
        const widthScale = containerRect.width / contentRect.width * INITIAL_FONT_SIZE;
        return getFontSizeInRange(widthScale);
    }

    return INITIAL_FONT_SIZE; // Default for 'none'
}

/**
 * Finds the optimal number of columns for content layout
 */
function findOptimalColumnCount(
    cloneEl: HTMLElement | null,
    containerRect: DOMRect | undefined,
    layout: LayoutSettings,
    minColumns: number = 1,
    maxColumns: number = 4
): number {
    // Safety checks for null elements
    if (!cloneEl || !containerRect) {
        return 1;
    }

    if (!layout.multiColumns || layout.fitScreenMode === "fitX" || layout.fitScreenMode === "none") {
        // fitX always has the optimal solution as zero
        // ideally, this function would not be called if fit mode is 'none' but if it is, it makes most sense to return 1
        return 1;
    } else if (!layout.smartColumns) {
        return 2;
    }

    if (layout.fitScreenMode !== "fitXY") {
        console.error("Error: Unknown fit screen mode!")
        return 1;
    }

    let bestFontSize = 0;
    let bestColumns = 1;

    try {
        // First measure single-column layout to establish baseline
        const child = cloneEl.querySelector('#song-content-wrapper');
        if (child) {
            (child as HTMLElement).style.columnCount = '1';
        } else {
            cloneEl.style.columnCount = '1';
        }

        const singleColRect = cloneEl.getBoundingClientRect();
        const baseWidth = singleColRect.width;
        const baseHeight = singleColRect.height;

        // Skip further calculations if we have invalid measurements
        if (baseWidth <= 0 || baseHeight <= 0) {
            return 1;
        }

        // Use approximation to estimate multi-column layouts
        for (let cols = minColumns; cols <= maxColumns; cols++) {
            // Approximate dimensions for this column count
            // Width increases roughly linearly with column count (accounting for gaps)
            const approxWidth = baseWidth * cols + (COLUMN_GAP_PX * (cols - 1));

            // Height decreases roughly proportionally with column count
            // This approximation assumes content distributes fairly evenly
            const approxHeight = Math.ceil(baseHeight / cols);

            // Calculate font size based on approximated dimensions
            const widthScale = containerRect.width / approxWidth;
            const heightScale = containerRect.height / approxHeight;
            const calculatedFontSize = getFontSizeInRange(Math.min(widthScale, heightScale) * INITIAL_FONT_SIZE);

            // Update if this configuration allows a larger font size
            if (calculatedFontSize > HIGHER_COL_RATIO * bestFontSize) {
                bestFontSize = calculatedFontSize;
                bestColumns = cols;
            } else {
                // If font size is decreasing, we've found the optimal column count
                break;
            }
        }
    } catch (error) {
        console.error("Error calculating optimal column count:", error);
        return 1; // Default to 1 column in case of error
    }

    return bestColumns;
}

/**
 * Calculates the precise font size for a given column count
 */
function calculatePreciseFontSize(
    cloneEl: HTMLElement | null,
    containerRect: DOMRect | undefined,
    fitMode: FitScreenMode,
    columnCount: number
): number {
    // Safety checks
    if (!cloneEl || !containerRect) {
        return INITIAL_FONT_SIZE;
    }

    try {
        // Set the column count for precise measurement
        const child = cloneEl.querySelector('#song-content-wrapper');
        if (child) {
            (child as HTMLElement).style.columnCount = `${columnCount}`;
        } else {
            cloneEl.style.columnCount = `${columnCount}`;
        }

        // Get precise content size for the selected column count
        const preciseRect = cloneEl.getBoundingClientRect();

        // Calculate font size with precise measurements
        return calculateFontSize(preciseRect, containerRect, fitMode);
    } catch (error) {
        console.error("Error calculating precise font size:", error);
        return INITIAL_FONT_SIZE; // Default in case of error
    }
}

let renderCount = 0;

export function ResizableAutoTextSize({
    children,
    gestureContainerRef,
    className,
}: ResizableAutoTextSizeProps) {
    renderCount++;
    console.log(`Render #${renderCount} - Component rendering`);

    const { layout, chords, actions } = useViewSettingsStore();

    // States that need to trigger re-renders
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    const [columnCount, setColumnCount] = useState(1);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const cloneRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const updateLayout = useCallback(() => {
        if (!cloneRef.current || !containerRef.current || layout.fitScreenMode === "none") return;

        const containerRect = containerRef.current.getBoundingClientRect();

        const optimalColumnCount = findOptimalColumnCount(
            cloneRef.current,
            containerRect,
            layout
        );

        setColumnCount(optimalColumnCount);

        const newFontSize = calculatePreciseFontSize(
            cloneRef.current,
            containerRect,
            layout.fitScreenMode,
            optimalColumnCount
        );

        setFontSize(newFontSize);
    }, [chords, layout]);

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

    const contentClasses = cn(
        className,
        'max-w-screen dark:text-white/95',
        chords.inlineChords ? 'chords-inline' : '',
        chords.showChords ? '' : 'chords-hidden',
        `fit-screen-${layout.fitScreenMode}`,
        layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
        (layout.multiColumns) ? 'song-content-columns' : '',
        layout.fitScreenMode === "none" ? "fit-screen-none" : "",
        // Apply column count dynamically
        columnCount === 2 ? `[&>*]:columns-2` : "",
        columnCount === 3 ? `[&>*]:columns-3` : "",
        columnCount === 4 ? `[&>*]:columns-4` : "",
        `[&>*]:gap-[${COLUMN_GAP}]`
    );

    return (
        <>
            {/* Main visible content */}
            <div
                className="relative flex h-full w-full max-w-full"
                ref={containerRef}
            >
                <div
                    ref={contentRef}
                    className={contentClasses}
                    style={{
                        fontSize: `${fontSize}px`,
                        columnGap: COLUMN_GAP,
                    }}
                >
                    {children}
                </div>
            </div>

            {/* Hidden clone for measurements (always present) */}
            <div
                className="absolute -left-[9999px] -top-[9999px] invisible pointer-events-none"
                aria-hidden="true"
            >
                <div
                    ref={cloneRef}
                    className={contentClasses}
                    style={{
                        fontSize: `${INITIAL_FONT_SIZE}px`,
                        width: 'auto',
                        height: 'auto',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        overflow: 'visible',
                    }}
                >
                    {children}
                </div>
            </div>
        </>
    );
}

export default ResizableAutoTextSize;