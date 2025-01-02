import { useGesture } from '@use-gesture/react'
import { updateTextSize } from "auto-text-size";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from "react";
import { getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";

interface ResizableAutoTextSizeProps {
    minFontSizePx: number
    maxFontSizePx: number
    children: React.ReactNode
    containerRef: React.RefObject<HTMLDivElement>  // Pass the container ref from parent
}

export function ResizableAutoTextSize({
    minFontSizePx,
    maxFontSizePx,
    children,
    containerRef
}: ResizableAutoTextSizeProps) {
    console.log("render")
    const { layout, actions } = useViewSettingsStore();
    // using Zustand for fontSize was extremely laggy on Safari --> using local state and debounced sync with Zustand instead
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    useEffect(() => {
        if (layout.fontSize === fontSize) return;
        const timeoutId = setTimeout(() => {
            actions.setLayoutSettings({ fontSize });
            // if (fontSize !== layout.fontSize) {
            // }
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [fontSize, actions, layout.fontSize]);

    useLayoutEffect(() => {
        if (pinching) return; // avoid loop
        // if (layout.fontSize === fontSize) return;
        setFontSize(layout.fontSize);
    }, [layout.fontSize, pinching])

    // Gesture handling
    useGesture({
        onPinchStart: () => { setPinching(true) },
        onPinchEnd: () => { setPinching(false) },
        onPinch: ({ movement: [dScale], memo, first }) => {
            if (!memo) memo = fontSize;
            if (first) actions.setLayoutSettings({ fitScreenMode: "none" })
            const newFontSize = getFontSizeInRange(memo * dScale, minFontSizePx, maxFontSizePx);
            setFontSize(newFontSize);
            return memo;
        },
    }, {
        target: containerRef,
        eventOptions: { passive: true },
    })

    // Auto-sizing logic (if needed)
    const innerElRef = useRef<HTMLDivElement>(null);
    const updateSize = useCallback(() => {
        const innerEl = innerElRef.current;
        const containerEl = innerEl?.parentElement;
        if (!innerEl || !containerEl || layout.fitScreenMode === "none") return;

        const autoTextMode = layout.fitScreenMode === "fitXY" ? "boxoneline" : "oneline";
        updateTextSize({
            innerEl,
            containerEl,
            mode: autoTextMode,
            minFontSizePx,
            maxFontSizePx,
            fontSizePrecisionPx: 0.1,
        });

        const computedFontSize = getComputedStyle(innerEl).fontSize;
        setFontSize(parseFloat(computedFontSize));
    }, [layout.fitScreenMode, minFontSizePx, maxFontSizePx]);

    useLayoutEffect(() => {
        const containerEl = containerRef.current;
        if (!containerEl) return;

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerEl);

        return () => {
            resizeObserver.disconnect();
        };
    }, [updateSize, containerRef]);

    return (
        <div ref={innerElRef} style={{ fontSize }}>
            {children}
        </div>
    );
}

export default ResizableAutoTextSize;
