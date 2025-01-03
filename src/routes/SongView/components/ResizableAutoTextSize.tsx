import { useGesture } from '@use-gesture/react'
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
    useRef
} from "react";
import { getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";
import { useMeasure } from '@uidotdev/usehooks';
import React from 'react';

/**
 * Ensures that `func` is not called more than once per animation frame.
 * taken from https://github.com/sanalabs/auto-text-size/blob/main/src/auto-text-size-standalone.ts
 * Using requestAnimationFrame in this way ensures that we render as often as
 * possible without excessively blocking the UI.
 */
// function throttleAnimationFrame(func: () => void): () => void {
//     let wait = false;

//     return () => {
//         if (!wait) {
//             wait = true;
//             requestAnimationFrame(() => {
//                 func();
//                 wait = false;
//             });
//         }
//     };
// }

interface ResizableAutoTextSizeProps {
    children: React.ReactNode
    gestureContainerRef: React.RefObject<HTMLDivElement>
    excludeSelector?: string
    overflowClasses?: string
}

const DUMMY_FONT_SIZE_PX = 16;

export function ResizableAutoTextSize({
    children,
    gestureContainerRef,
    excludeSelector,
    overflowClasses = "no-scrollbar overflow-x-auto overflow-y-clip",
}: ResizableAutoTextSizeProps) {
    const { layout, actions } = useViewSettingsStore();
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [emptyDimensions, setEmptyDimensions] = useState<{ width: number | null, height: number | null }>({ width: null, height: null });

    const [containerDivRef, containerDimensions] = useMeasure();
    const [hiddenDivRef, measuredDimensions] = useMeasure();

    // Setup overflow management
    useLayoutEffect(() => {
        const elements = document.querySelectorAll(excludeSelector ?? "");
        elements.forEach((element) => {
            const classesToAdd = overflowClasses.split(" ");
            element.classList.add(...classesToAdd);
        });

        const excludedElements = document.querySelectorAll(excludeSelector ? `#dummy-contents ${excludeSelector}` : "")
        excludedElements.forEach((element) => {
            (element as HTMLElement).style.width = '0';
        });
    }, [excludeSelector, overflowClasses]);

    useLayoutEffect(() => {
        if (pinching) return;
        setFontSize(layout.fontSize);
    }, [layout.fontSize, pinching]);

    useEffect(() => {
        if (initialized || !containerDimensions.width || !measuredDimensions.width) return;
        setEmptyDimensions({ width: containerDimensions.width, height: containerDimensions.height })
        setInitialized(true);
    }, [containerDimensions, initialized, measuredDimensions])

    useGesture({
        onPinchStart: () => { actions.setLayoutSettings({ fitScreenMode: "none" }); setPinching(true) },
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

    const updateFontSize = useCallback(() => {
        const widthAvailable = emptyDimensions.width || measuredDimensions.width;
        const heightAvailable = emptyDimensions.height || measuredDimensions.height;
        if (layout.fitScreenMode === "none" || !widthAvailable) return;
        let scaleFactor;
        if (layout.fitScreenMode === "fitXY") {
            if (!heightAvailable) return;
            const widthScale = emptyDimensions.width / measuredDimensions.width * DUMMY_FONT_SIZE_PX;
            const heightScale = emptyDimensions.height / measuredDimensions.height * DUMMY_FONT_SIZE_PX;
            scaleFactor = Math.min(widthScale, heightScale);
        } else if (layout.fitScreenMode === "fitX") {
            scaleFactor = emptyDimensions.width / measuredDimensions.width * DUMMY_FONT_SIZE_PX;
        } else {
            throw Error("Invalid fitScreenMode");
        }

        const newFontSize = getFontSizeInRange(scaleFactor);
        setFontSize(newFontSize);
        // while this depends on fitScreenMode, I do not want it to be updated when it changes (only when measuredDimensions, which is also dependent on it, changes)
        // maybe this could be split in two functions to make this OK for React?
    }, [emptyDimensions, measuredDimensions]);

    // const throttleUpdateFontSize = throttleAnimationFrame(updateFontSize);

    useLayoutEffect(() => {
        updateFontSize();
    }, [
        updateFontSize,
        // layout.fitScreenMode,
        // layout.repeatParts,
        // layout.repeatPartsChords,
        // layout.twoColumns
    ]);

    return (
        <div className='relative flex h-full w-full max-w-full'
            ref={containerDivRef}
        >
            <div id="actual-contents" className='max-w-full'
                style={{
                    fontSize: `${fontSize}px`,
                }}
            >
                {initialized && children}
            </div>
            <div
                id="dummy-contents"
                ref={hiddenDivRef}
                style={{
                    position: 'fixed',
                    left: '-9999px',
                    visibility: 'hidden',
                    fontSize: `${DUMMY_FONT_SIZE_PX}px`,
                    whiteSpace: layout.fitScreenMode === "fitX" ? 'nowrap' : 'normal',
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