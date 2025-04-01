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
const COLUMN_GAP_PX = 16; // Approximate pixel equivalent of 1em
const HIGHER_COL_RATIO = 1.1; // How many times larger font size needs to be in more columns to justify the switch

/**
 * Finds the optimal number of columns for content layout
 */
function setOptimalColumnCount(
    content: HTMLElement | null,
    containerRect: DOMRect | undefined,
    layout: LayoutSettings,
    minColumns: number = 1,
    maxColumns: number = 4,
    colElId: string = '#song-content-wrapper'
): number {
    let columnCount;
    // Safety checks for null elements
    if (!content || !containerRect) {
        columnCount = 1;
    } else if (!layout.multiColumns || layout.fitScreenMode === "fitX" || layout.fitScreenMode === "none") {
        // fitX always has the optimal solution as zero
        // ideally, this function would not be called if fit mode is 'none' but if it is, it makes most sense to return 1
        columnCount = 1;
    } else if (!layout.smartColumns) {
        columnCount = 2;
    } else if (layout.fitScreenMode !== "fitXY") {
        console.error("Error: Unknown fit screen mode!")
        columnCount = 1;
    }
    else {
        let bestFontSize = 0;
        let bestColumns = 1;

        try {
            // First measure single-column layout to establish baseline
            const child = content.querySelector(colElId) as HTMLElement;
            if (!child) {
                throw Error("Song content wrapper not found!")
            }
            child.style.columnCount = '1';

            const singleColRect = content.getBoundingClientRect();
            const baseWidth = singleColRect.width;
            const baseHeight = singleColRect.height;

            // Skip further calculations if we have invalid measurements
            if (baseWidth <= 0 || baseHeight <= 0) {
                return 1;
            }

            console.log("gap:", content.style.columnGap, child.style.columnGap)
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
            columnCount = bestColumns;
        } catch (error) {
            console.error("Error calculating optimal column count:", error);
            return 1; // Default to 1 column in case of error
        }
    }
    const child = content.querySelector(colElId) as HTMLElement;
    if (child) {
        child.style.columnCount = columnCount.toString();
    }

    return columnCount;
}

/**
 * Calculates font size based on content dimensions and container dimensions
 */
function calculateFontSize(
    contentRect: DOMRect,
    containerRect: DOMRect,
    fitMode: FitScreenMode,
    fontSize: number,
): number {
    console.log("content", contentRect, "container", containerRect)
    if (fitMode === 'fitXY') {
        const widthScale = containerRect.width / contentRect.width * fontSize;
        const heightScale = containerRect.height / contentRect.height * fontSize;
        return getFontSizeInRange(Math.min(widthScale, heightScale));
    } else if (fitMode === 'fitX') {
        const widthScale = containerRect.width / contentRect.width * fontSize;
        return getFontSizeInRange(widthScale);
    }
    // no change for fitMode 'none'
    return fontSize;
}

/**
 * Calculates the precise font size for a given column count
 */
function calculatePreciseFontSize(
    content: HTMLElement | null,
    containerRect: DOMRect | undefined,
    fitMode: FitScreenMode,
): number {
    // Safety checks
    if (!content || !containerRect) {
        return INITIAL_FONT_SIZE;
    }

    try {
        // Get precise content size for the selected column count
        const preciseRect = content.getBoundingClientRect();

        // Calculate font size with precise measurements
        const currentFontSize = parseFloat(content.style.fontSize) || INITIAL_FONT_SIZE;
        console.log(currentFontSize)
        return calculateFontSize(preciseRect, containerRect, fitMode, currentFontSize);
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

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // const cloneRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const updateLayout = useCallback(() => {
        if (!containerRef.current || layout.fitScreenMode === "none") return;

        const containerRect = containerRef.current.getBoundingClientRect();

        setOptimalColumnCount(
            contentRef.current,
            containerRect,
            layout
        );

        const newFontSize = calculatePreciseFontSize(
            contentRef.current,
            containerRect,
            layout.fitScreenMode,
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
        `[&>*]:gap-4`, `sm:[&>*]:gap-8`, `lg:[&>*]:gap-16`,
        "h-fit"
    );

    return (
        <>
            <div
                className="relative flex h-full w-full max-w-full"
                ref={containerRef}
            >
                <div
                    ref={contentRef}
                    className={contentClasses}
                    style={{
                        fontSize: `${fontSize}px`,
                    }}
                >
                    {children}
                </div>
            </div>
        </>
    );
}

export default ResizableAutoTextSize;