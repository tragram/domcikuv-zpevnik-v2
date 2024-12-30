import { updateTextSize } from "auto-text-size";
import {
    useCallback,
    useLayoutEffect,
    useRef
} from "react";

/**
 * Make text fit container, prevent overflow and underflow.
 */
export function CustomAutoTextSize({
    fitMode,
    minFontSizePx,
    maxFontSizePx,
    fontSizePrecisionPx = 0.1,
    fontSize,
    setFontSize,
    children,
    ...rest
}) {
    const innerElRef = useRef(null);
    const updateSize = useCallback(() => {
        const innerEl = innerElRef.current as HTMLElement | null;
        const containerEl = innerEl?.parentElement;
        if (!innerEl || !containerEl || fitMode === "none") return;

        const autoTextMode = fitMode === "fitXY" ? "boxoneline" : "oneline";
        updateTextSize({
            innerEl,
            containerEl,
            mode: autoTextMode,
            minFontSizePx,
            maxFontSizePx,
            fontSizePrecisionPx,
        });

        // Update the fontSize state with the computed value
        const computedFontSize = getComputedStyle(innerEl).fontSize;
        setFontSize(parseFloat(computedFontSize));
    }, [fitMode, fontSizePrecisionPx, maxFontSizePx, minFontSizePx, setFontSize]);


    useLayoutEffect(() => {
        updateSize();
        // Set up the resize observer
        const containerEl = (innerElRef.current as HTMLElement | null)?.parentElement;
        if (!containerEl) return;

        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });

        resizeObserver.observe(containerEl);

        return () => {
            resizeObserver.disconnect();
        };
    }, [updateSize]);


    return (
        <div ref={innerElRef} style={{ fontSize: fontSize }}{...rest}>
            {children}
        </div>
    );
}