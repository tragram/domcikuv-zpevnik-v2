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
    container: HTMLElement | null,
    layout: LayoutSettings,
    minColumns: number = 1,
    maxColumns: number = 4,
    colElId: string = '#song-content-wrapper'
): number {
    let columnCount;
    // Safety checks for null elements
    if (!content || !container) {
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
            const containerRect = container.getBoundingClientRect();
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
    const child = content?.querySelector(colElId) as HTMLElement;
    if (child) {
        child.style.columnCount = columnCount.toString();
    }
    console.log(columnCount)
    return columnCount;
}

const getElementFontSize = (
    element: HTMLElement | null
): number => {
    return element ? parseFloat(element.style.fontSize) || INITIAL_FONT_SIZE : INITIAL_FONT_SIZE;
}

const setElementFontSize = (
    element: HTMLElement,
    fontSize: number
) => {
    element.style.fontSize = fontSize.toString() + "px";
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
    // console.log(`Content dimensions: width=${contentRect.width.toFixed(2)}px, height=${contentRect.height.toFixed(2)}px`);
    // console.log(`Container dimensions: width=${containerRect.width.toFixed(2)}px, height=${containerRect.height.toFixed(2)}px`);
    if (fitMode === 'fitXY') {
        const widthScale = containerRect.width / contentRect.width * fontSize;
        const heightScale = containerRect.height / contentRect.height * fontSize;
        // console.log("Width scale:", widthScale, "Height scale:", heightScale, "starting fontSize:", fontSize);
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
function setFontSize(
    content: HTMLElement | null,
    container: HTMLElement | null,
    fitMode: FitScreenMode,
): number {
    // Safety checks
    if (!content || !container) {
        return INITIAL_FONT_SIZE;
    }

    try {
        // Get precise content size for the selected column count
        const preciseRect = content.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate font size with precise measurements
        const currentFontSize = getElementFontSize(content);
        // console.log("calculatePreciseFontSize found current font size", currentFontSize, "px")
        const newFontSize = calculateFontSize(preciseRect, containerRect, fitMode, currentFontSize);
        setElementFontSize(content, newFontSize);
        return newFontSize;
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
    // const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    const updateLayout = useCallback(() => {
        if (!contentRef.current || !containerRef.current || layout.fitScreenMode === "none") return;

        setOptimalColumnCount(
            contentRef.current,
            containerRef.current,
            layout
        );

        setFontSize(
            contentRef.current,
            containerRef.current,
            layout.fitScreenMode,
        );
        // console.log("found newFontSize", newFontSize)
        // setFontSize(newFontSize);
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

    // // Handle pinch gestures
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

    // TODO: after reload, font size is not kept...
    // Sync fontSize with layout when not pinching
    // useLayoutEffect(() => {
    //     if (!pinching && layout.fitScreenMode === 'none') {
    //         setFontSize(layout.fontSize);
    //     }
    // }, [layout.fontSize, layout.fitScreenMode, pinching]);


    return (
        <div
            className="relative flex h-full w-full max-w-full"
            ref={containerRef}
        >
            <div
                ref={contentRef}
                className={
                    cn(
                        className,
                        'max-w-screen dark:text-white/95 h-fit',
                        chords.inlineChords ? 'chords-inline' : '',
                        chords.showChords ? '' : 'chords-hidden',
                        `fit-screen-${layout.fitScreenMode}`,
                        layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
                        layout.fitScreenMode === "none" ? "fit-screen-none" : "",
                        `[&>*]:gap-4`, `sm:[&>*]:gap-8`, `lg:[&>*]:gap-16`,
                    )}
            // style={{
            //     fontSize: `${fontSize}px`,
            // }}
            >
                {children}
            </div>
        </div>
    );
}

export default ResizableAutoTextSize;