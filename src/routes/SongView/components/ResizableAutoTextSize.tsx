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
    console.log(fontSize)
    const [pinching, setPinching] = useState(false);

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

    const calculateFontSize = useCallback(() => {
        const widthAvailable = containerDimensions.width || measuredDimensions.width;
        const heightAvailable = containerDimensions.height || measuredDimensions.height;
        if (layout.fitScreenMode === "none" || !widthAvailable) return;
        let scaleFactor;
        if (layout.fitScreenMode === "fitXY") {
            if (!heightAvailable) return;
            const widthScale = containerDimensions.width / measuredDimensions.width * DUMMY_FONT_SIZE_PX;
            const heightScale = containerDimensions.height / measuredDimensions.height * DUMMY_FONT_SIZE_PX;
            scaleFactor = Math.min(widthScale, heightScale);
            console.log("container:", containerDimensions)
            console.log("text:", measuredDimensions)
            console.log("scale:", scaleFactor)
        } else if (layout.fitScreenMode === "fitX") {
            scaleFactor = containerDimensions.width / measuredDimensions.width * DUMMY_FONT_SIZE_PX;
        } else {
            throw Error("Invalid fitScreenMode");
        }

        const newFontSize = getFontSizeInRange(scaleFactor);
        setFontSize(newFontSize);
    }, [containerDimensions, measuredDimensions, layout.fitScreenMode]);

    useLayoutEffect(() => {
        calculateFontSize();
    }, [
        calculateFontSize,
        layout.fitScreenMode,
        layout.repeatParts,
        layout.repeatPartsChords,
        layout.twoColumns
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
                {children}
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