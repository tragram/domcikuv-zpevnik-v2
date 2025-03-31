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
// Define a consistent column gap value to use both in calculations and styling
const COLUMN_GAP = '1em';
const COLUMN_GAP_PX = 16; // Approximate pixel equivalent of 1em
const HIGHER_COL_RATIO = 1.1; // How many times larger font size needs to be in more columns to justify the switch

/**
 * Creates a clone element for measurement purposes
 */
function createMeasurementClone(originalEl: HTMLElement): HTMLElement {
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
    clone.style.columnGap = COLUMN_GAP;
    clone.ariaHidden = 'true';
    return clone;
}

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
function optimalColumnCount(
    originalEl: HTMLElement | null,
    containerRect: DOMRect | undefined,
    fitMode: FitScreenMode,
    multiColumns: boolean,
    smartColumns: boolean,
    minColumns: number = 1,
    maxColumns: number = 4
): number {
    // Safety checks for null elements
    if (!originalEl || !containerRect) {
        return 1;
    }
    
    if (!multiColumns) {
        return 1;
    } else if (!smartColumns) {
        return 2;
    }
    
    // Create a clone for measurement
    const clone = createMeasurementClone(originalEl);
    document.body.appendChild(clone);
    let bestFontSize = 0;
    let bestColumns = 1;

    try {
        // First measure single-column layout to establish baseline
        const child = clone.querySelector('#song-content-wrapper');
        if (child) {
            (child as HTMLElement).style.columnCount = '1';
        }

        const singleColRect = clone.getBoundingClientRect();
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
            let calculatedFontSize;
            if (fitMode === 'fitXY') {
                const widthScale = containerRect.width / approxWidth;
                const heightScale = containerRect.height / approxHeight;
                calculatedFontSize = getFontSizeInRange(Math.min(widthScale, heightScale) * INITIAL_FONT_SIZE);
            } else if (fitMode === 'fitX') {
                const widthScale = containerRect.width / approxWidth;
                calculatedFontSize = getFontSizeInRange(widthScale * INITIAL_FONT_SIZE);
            } else {
                calculatedFontSize = INITIAL_FONT_SIZE; // Default for 'none'
            }

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
    } finally {
        // Always clean up the clone
        if (clone.parentNode) {
            document.body.removeChild(clone);
        }
    }

    return bestColumns;
}

/**
 * Calculates the precise font size for a given column count
 */
function calculatePreciseFontSize(
    originalEl: HTMLElement | null,
    containerRect: DOMRect | undefined,
    fitMode: FitScreenMode,
    columnCount: number
): number {
    // Safety checks
    if (!originalEl || !containerRect) {
        return INITIAL_FONT_SIZE;
    }

    // Create a clone for measurement
    const clone = createMeasurementClone(originalEl);
    document.body.appendChild(clone);
    let fontSize = INITIAL_FONT_SIZE;

    try {
        // Set the column count for precise measurement
        const child = clone.querySelector('#song-content-wrapper');
        if (child) {
            (child as HTMLElement).style.columnCount = `${columnCount}`;
        }

        // Get precise content size for the selected column count
        const preciseRect = clone.getBoundingClientRect();

        // Calculate font size with precise measurements
        fontSize = calculateFontSize(preciseRect, containerRect, fitMode);
    } catch (error) {
        console.error("Error calculating precise font size:", error);
        return INITIAL_FONT_SIZE; // Default in case of error
    } finally {
        // Always clean up the clone
        if (clone.parentNode) {
            document.body.removeChild(clone);
        }
    }

    return fontSize;
}

export function ResizableAutoTextSize({
    children,
    gestureContainerRef,
    className,
}: ResizableAutoTextSizeProps) {
    const { layout, chords, actions } = useViewSettingsStore();
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [columnCount, setColumnCount] = useState(1); // Default to 1 column

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

    // Calculate optimal column count
    const calculateOptimalColumns = useCallback(() => {
        if (!contentRef.current || !containerRef.current) return 1;
        
        return optimalColumnCount(
            contentRef.current,
            containerRef.current.getBoundingClientRect(),
            layout.fitScreenMode,
            layout.multiColumns,
            layout.smartColumns
        );
    }, [layout.fitScreenMode, layout.multiColumns, layout.smartColumns]);

    // Function to measure and update layout
    const updateLayout = useCallback(() => {
        if (!containerRef.current || !contentRef.current || pinching || layout.fitScreenMode === 'none') {
            if (layout.fitScreenMode === 'none') {
                setFontSize(layout.fontSize);
            }
            return;
        }
        
        const newFontSize = calculatePreciseFontSize(
            contentRef.current,
            containerRef.current.getBoundingClientRect(),
            layout.fitScreenMode,
            columnCount
        );
        
        setFontSize(newFontSize);
    }, [layout.fitScreenMode, layout.fontSize, pinching, columnCount]);

    // Update column count when dependencies change
    useLayoutEffect(() => {
        if (isInitialized && contentRef.current && containerRef.current) {
            const newColumnCount = calculateOptimalColumns();
            setColumnCount(newColumnCount);
        }
    }, [
        isInitialized,
        calculateOptimalColumns,
        layout.multiColumns,
        layout.smartColumns,
    ]);

    // Update font size when dependencies change
    useLayoutEffect(() => {
        if (isInitialized) {
            updateLayout();
        }
    }, [
        isInitialized,
        updateLayout,
        columnCount,
        layout.fitScreenMode,
        children
    ]);

    // Initial setup and resize observer
    useLayoutEffect(() => {
        if (!containerRef.current || !contentRef.current) return;

        if (!isInitialized) {
            // Hide content until first measurement is done
            contentRef.current.style.visibility = 'hidden';
            
            // Initial column count calculation
            const initialColumnCount = calculateOptimalColumns();
            setColumnCount(initialColumnCount);
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
                if (contentRef.current && isInitialized && !pinching) {
                    // Recalculate columns on resize
                    const newColumnCount = calculateOptimalColumns();
                    if (newColumnCount !== columnCount) {
                        setColumnCount(newColumnCount);
                    }
                    
                    // Update font size
                    updateLayout();
                }
            });

            resizeObserverRef.current.observe(containerRef.current);
        }

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
        };
    }, [layout.fitScreenMode, isInitialized, updateLayout, calculateOptimalColumns, columnCount, pinching]);

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
                    // Apply column count dynamically
                    columnCount === 2 ? `[&>*]:columns-2` : "",
                    columnCount === 3 ? `[&>*]:columns-3` : "",
                    columnCount === 4 ? `[&>*]:columns-4` : "",
                )}
                style={{
                    fontSize: `${fontSize}px`,
                    columnGap: COLUMN_GAP, // Consistent column gap styling
                }}
            >
                {children}
            </div>
        </div>
    );
}

export default ResizableAutoTextSize;