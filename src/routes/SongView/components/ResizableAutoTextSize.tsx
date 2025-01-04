import { useGesture } from '@use-gesture/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FitScreenMode, getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";
import React from 'react';
import { cn } from '@/lib/utils';

interface ResizableAutoTextSizeProps {
    children: React.ReactNode
    gestureContainerRef: React.RefObject<HTMLDivElement>
    className?: string
}

const DUMMY_FONT_SIZE = 16;

type FitState = {
    status: 'not-initialized' | 'idle' | 'preparing-measurement' | 'measuring' | 'applying-changes';
    targetMode: FitScreenMode;
    pendingClasses?: string;
}

function computeFontSize(dummyEl: HTMLElement, containerEl: HTMLElement, targetMode: FitScreenMode) {
    const dummyRect = dummyEl.getBoundingClientRect();
    const containerSize = containerEl.getBoundingClientRect();
    let newFontSize;

    const widthScale = containerSize.width / dummyRect.width * DUMMY_FONT_SIZE;
    if (targetMode === 'fitXY') {
        const heightScale = containerSize.height / dummyRect.height * DUMMY_FONT_SIZE;
        newFontSize = getFontSizeInRange(Math.min(widthScale, heightScale));
    } else if (targetMode === 'fitX') {
        newFontSize = getFontSizeInRange(widthScale);
    } else {
        throw new Error("Invalid fit mode");
    }
    return newFontSize;
}

export function ResizableAutoTextSize({
    children,
    gestureContainerRef,
    className
}: ResizableAutoTextSizeProps) {
    const { layout, chords, actions } = useViewSettingsStore();
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dummyRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [visibleClasses, setVisibleClasses] = useState(className);

    // Compute new classes when dependencies change
    const classNames = useMemo(() => {
        const newClasses = cn(
            className,
            'max-w-screen dark:text-white/95',
            chords.inlineChords ? 'chords-inline' : '',
            chords.showChords ? '' : 'chords-hidden',
            `fit-screen-${layout.fitScreenMode}`,
            layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
            layout.twoColumns ? 'song-content-columns' : ''
        );
        return newClasses;
    }, [className, chords.inlineChords, chords.showChords, layout.fitScreenMode, layout.repeatPartsChords, layout.twoColumns]);

    const [fitState, setFitState] = useState<FitState>({
        status: 'not-initialized',
        targetMode: layout.fitScreenMode,
        pendingClasses: classNames
    });

    // Update classes sequence
    useEffect(() => {
        // Step 1: Update dummy element classes and prepare for measurement
        setFitState(prev => ({
            status: 'preparing-measurement',
            targetMode: layout.fitScreenMode,
            pendingClasses: classNames
        }));

        resizeObserverRef.current?.disconnect();
        // Step 2: Schedule measurement after dummy update
        requestAnimationFrame(() => {
            setFitState(prev => ({
                ...prev,
                status: 'measuring'
            }));
            if (containerRef.current) {
                resizeObserverRef.current = new ResizeObserver(() => setFitState(prev => ({ status: "measuring", targetMode: prev.targetMode, pendingClasses: classNames })));
                resizeObserverRef.current.observe(containerRef.current);
            }
        });
    }, [classNames, layout.fitScreenMode, layout.twoColumns, layout.repeatParts, layout.repeatPartsChords, fitState.targetMode, chords]);

    // Handle measurements and class updates
    useEffect(() => {
        if (fitState.status !== 'measuring' || !containerRef.current || !dummyRef.current) return;

        // Perform measurement
        const newFontSize = fitState.targetMode === "none" ?
            layout.fontSize :
            computeFontSize(dummyRef.current, containerRef.current, fitState.targetMode);

        // Step 3: Apply changes to visible element
        setFontSize(newFontSize);
        setVisibleClasses(fitState.pendingClasses);

        setFitState(prev => ({
            ...prev,
            status: 'idle',
        }));
    }, [fitState, layout.fontSize]);

    // Sync fontSize with layout when not pinching
    useEffect(() => {
        if (!pinching) {
            setFontSize(layout.fontSize);
        }
    }, [layout.fontSize, pinching]);

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
                id="actual-contents"
                className={cn(
                    visibleClasses,
                    fitState.status === 'not-initialized' ? "invisible" : "visible"
                )}
                style={{ fontSize: `${fontSize}px` }}
            >
                {children}
            </div>
            <div
                id="dummy-contents"
                ref={dummyRef}
                className={fitState.pendingClasses}
                style={{
                    position: 'fixed',
                    left: '-9999px',
                    visibility: 'hidden',
                    fontSize: `${DUMMY_FONT_SIZE}px`,
                    pointerEvents: 'none'
                }}
                aria-hidden="true"
            >
                {children}
            </div>
        </div>
    );
}

export default ResizableAutoTextSize;