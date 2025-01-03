import { useGesture } from '@use-gesture/react'
import { updateTextSize } from "auto-text-size";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { getFontSizeInRange, useViewSettingsStore } from "../hooks/viewSettingsStore";

/**
 * Ensures that `func` is not called more than once per animation frame.
 * taken from https://github.com/sanalabs/auto-text-size/blob/main/src/auto-text-size-standalone.ts
 * Using requestAnimationFrame in this way ensures that we render as often as
 * possible without excessively blocking the UI.
 */
function throttleAnimationFrame(func: () => void): () => void {
    let wait = false;

    return () => {
        if (!wait) {
            wait = true;
            requestAnimationFrame(() => {
                func();
                wait = false;
            });
        }
    };
}

const getContentDimensions = (element: HTMLElement): [number, number] => {
    const computedStyle = getComputedStyle(element);
    return [
        element.clientWidth -
        parseFloat(computedStyle.paddingLeft) -
        parseFloat(computedStyle.paddingRight),

        element.clientHeight -
        parseFloat(computedStyle.paddingTop) -
        parseFloat(computedStyle.paddingBottom)
    ];
};

interface ResizableAutoTextSizeProps {
    minFontSizePx: number
    maxFontSizePx: number
    children: React.ReactNode
    containerRef: React.RefObject<HTMLDivElement>  // container ref for gestures
    excludeSelector?: string // ignored in autosizing
    overflowClasses?: string // added to the excluded elements
}

export function ResizableAutoTextSize({
    minFontSizePx,
    maxFontSizePx,
    children,
    containerRef,
    excludeSelector,
    overflowClasses = "no-scrollbar overflow-x-auto overflow-y-clip",
}: ResizableAutoTextSizeProps) {
    const { layout, actions } = useViewSettingsStore();
    const [fontSize, setFontSize] = useState(layout.fontSize);
    const [pinching, setPinching] = useState(false);
    const [containerDimensions, setContainerDimensions] = useState<[number, number] | undefined>(undefined);

    // Setup overflow management
    useEffect(() => {
        const innerEl = innerElRef.current;
        if (!innerEl) return;

        const elements = innerEl.querySelectorAll(excludeSelector ?? "");
        elements.forEach((element) => {
            const classesToAdd = overflowClasses.split(" ");
            element.classList.add(...classesToAdd);
        });

        return () => {
            elements.forEach((element) => {
                const classesToRemove = overflowClasses.split(" ");
                element.classList.remove(...classesToRemove);
            });
        };
    }, [excludeSelector, overflowClasses]);

    useLayoutEffect(() => {
        if (pinching) return; // avoid loop
        // if (layout.fontSize === fontSize) return;
        setFontSize(layout.fontSize);
    }, [layout.fontSize, pinching])

    useGesture({
        onPinchStart: () => { setPinching(true) },
        onPinchEnd: () => { actions.setLayoutSettings({ fontSize }); setPinching(false); },
        onPinch: ({ movement: [dScale], memo, first }) => {
            if (!memo) memo = fontSize;
            if (first) actions.setLayoutSettings({ fitScreenMode: "none" })
            const newFontSize = getFontSizeInRange(memo * dScale);
            setFontSize(newFontSize);
            return memo;
        },
    }, {
        target: containerRef,
        eventOptions: { passive: true },
    })

    const innerElRef = useRef<HTMLDivElement>(null);

    const updateSize = useCallback(() => {
        const innerEl = innerElRef.current;
        const containerEl = innerEl?.parentElement;
        if (!innerEl || !containerEl || layout.fitScreenMode === "none") return;

        // Temporarily set width of excluded elements to 0 during measurement
        const excludedElements = innerEl.querySelectorAll(excludeSelector ?? "");
        excludedElements.forEach((element) => {
            (element as HTMLElement).style.width = '0';
        });

        const autoTextMode = layout.fitScreenMode === "fitXY" ? "boxoneline" : "oneline";
        updateTextSize({
            innerEl,
            containerEl,
            mode: autoTextMode,
            minFontSizePx,
            maxFontSizePx,
            fontSizePrecisionPx: 0.1,
        });

        // restore width
        excludedElements.forEach((element) => {
            (element as HTMLElement).style.width = '100%';
        });

        const computedFontSize = getComputedStyle(innerEl).fontSize;
        setFontSize(parseFloat(computedFontSize));
    }, [layout.fitScreenMode, minFontSizePx, maxFontSizePx, excludeSelector]);

    const containerElement = () => {
        const innerEl = innerElRef.current;
        if (!innerEl) return;
        return innerEl.parentElement;
    }

    const getParentDimensions = useCallback(() => {
        const containerEl = containerElement();
        return getContentDimensions(containerEl);
    }, [])

    const throttledUpdateSize: any = useMemo(() => throttleAnimationFrame(() => {
        updateSize();

        const innerEl = innerElRef.current;
        if (!innerEl) return;
        setContainerDimensions(getParentDimensions())
    }), [getParentDimensions, updateSize])

    useLayoutEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            const prevContainerDimensions = containerDimensions;
            const currentContainerDimensions = getParentDimensions();

            if (
                prevContainerDimensions?.[0] !== currentContainerDimensions[0] ||
                prevContainerDimensions?.[1] !== currentContainerDimensions[1]
            ) {
                throttledUpdateSize();
            }
        });
        const containerEl = containerRef.current;
        if (!containerEl) return;

        resizeObserver.observe(containerEl);

        return () => {
            resizeObserver.disconnect();
        };
    }, [updateSize, containerRef, throttledUpdateSize, containerDimensions, getParentDimensions]);

    useLayoutEffect(() => {
        throttledUpdateSize();
    }, [layout.fitScreenMode, layout.repeatParts, layout.repeatPartsChords, layout.twoColumns, throttledUpdateSize])

    return (
        <div ref={innerElRef} style={{ fontSize }}>
            {children}
        </div>
    );
}

export default ResizableAutoTextSize;