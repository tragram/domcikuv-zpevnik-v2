import { useGesture } from '@use-gesture/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FitScreenMode, getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";
import React from 'react';
import { cn } from '@/lib/utils';


interface ResizableAutoTextSizeProps {
    children: React.ReactNode
    gestureContainerRef: React.RefObject<HTMLDivElement>
}

const DUMMY_FONT_SIZE = 16;

type FitState = {
    status: 'not-initialized' | 'idle' | 'preparing-measurement' | 'ready-to-measure';
    targetMode: FitScreenMode;
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
}: ResizableAutoTextSizeProps) {
    const { layout, chords, actions } = useViewSettingsStore();
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dummyRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [fitState, setFitState] = useState<FitState>({
        status: 'not-initialized',
        targetMode: layout.fitScreenMode
    });

    // wait for the dummy element to load before fitting
    useEffect(() => {
        if (fitState.status === "not-initialized" && dummyRef.current && containerRef.current) {
            const dummyEl = dummyRef.current;
            const containerEl = containerRef.current
            requestAnimationFrame(() => {
                const newFontSize = fitState.targetMode === "none" ? layout.fontSize : computeFontSize(dummyEl, containerEl, fitState.targetMode);
                setFontSize(newFontSize);
                setFitState({ status: 'idle', targetMode: fitState.targetMode });
            });
        }
    }, [fitState, layout.fontSize]);

    // Handle fit mode changes
    useEffect(() => {
        if (layout.fitScreenMode === "none") return;
        // avoid observer interfering with the fit
        resizeObserverRef.current?.disconnect()

        // Start measurement cycle
        setFitState({
            status: 'preparing-measurement',
            targetMode: layout.fitScreenMode
        });

        // Give React time to update dummy element
        requestAnimationFrame(() => {
            setFitState(prev => ({
                status: 'ready-to-measure',
                targetMode: prev.targetMode
            }));
            if (containerRef.current) {
                resizeObserverRef.current = new ResizeObserver(() => setFitState(prev => ({ status: "ready-to-measure", targetMode: prev.targetMode })));
                resizeObserverRef.current.observe(containerRef.current);
            }
        });
    }, [layout.fitScreenMode, layout.twoColumns, layout.repeatParts, layout.repeatPartsChords, fitState.targetMode,chords]);



    // Handle measurements
    useEffect(() => {
        if (fitState.status !== 'ready-to-measure' || fitState.targetMode === "none" || !containerRef.current || !dummyRef.current) return;
        const newFontSize = computeFontSize(dummyRef.current, containerRef.current, fitState.targetMode);
        setFontSize(newFontSize);
        setFitState({ status: 'idle', targetMode: fitState.targetMode });
    }, [fitState, containerRef]);

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
                    "max-w-full",
                    fitState.status === 'not-initialized' ? "invisible" : "visible"
                )}
                style={{ fontSize: `${fontSize}px` }}
            >
                {children}
            </div>
            <div
                id="dummy-contents"
                ref={dummyRef}
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