import React, {
    DetailedHTMLProps,
    HTMLAttributes,
    ReactElement,
    ReactHTML,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { autoTextSize, updateTextSize, } from "auto-text-size";

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
    const updateTextSizeRef = useRef<ReturnType<typeof autoTextSize>>();
    const innerElRef = useRef(null);
    useEffect(() => updateTextSizeRef.current?.(), [children]);
    useEffect(() => {
        updateTextSizeRef.current?.disconnect();
        updateTextSizeRef.current = undefined;
    }, []);



    useEffect(function autoTextSizer() {
        async function updateFontSizeProp(innerEl: HTMLElement) {
            // timeout necessary for the changes in style to propagate
            // no, using 0 here does not work
            await new Promise((resolve) => setTimeout(resolve, 10));
            const fontSize = getComputedStyle(innerEl).fontSize;
            setFontSize(parseFloat(fontSize));
        }
        const innerEl = innerElRef.current as HTMLElement | null;
        const containerEl = innerEl?.parentElement;
        if (!innerEl || !containerEl || fitMode === "none") return;

        updateTextSizeRef.current?.disconnect();
        const autoTextMode = fitMode === "fitXY" ? "boxoneline" : "oneline";
        updateTextSizeRef.current = autoTextSize({
            innerEl,
            containerEl,
            mode: autoTextMode,
            minFontSizePx,
            maxFontSizePx,
            fontSizePrecisionPx,
        });
        updateFontSizeProp(innerEl);
        return () => updateTextSizeRef.current?.disconnect();
    }, [innerElRef, fitMode, minFontSizePx, maxFontSizePx, fontSizePrecisionPx, setFontSize])

    useEffect(function disableAutoTextSize() {
        const innerEl = innerElRef.current as HTMLElement | null;
        if (!innerEl || fitMode !== "none") return;
        updateTextSizeRef.current?.disconnect();
        updateTextSizeRef.current = undefined;
    }, [fitMode])

    useEffect(function setCustomFontSize() {
        async function updateFontSizeStyle(innerEl: HTMLElement, fontSize: number) {
            // timeout necessary for the changes in style to propagate
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (fontSize != null) {
                innerEl.style.setProperty('font-size', `${fontSize.toFixed(1)}px`);
            }
        }
        const innerEl = innerElRef.current as HTMLElement | null;
        if (!innerEl || fitMode !== "none") return;
        updateFontSizeStyle(innerEl, fontSize);

    }, [fontSize, fitMode])
    return (
        <div ref={innerElRef} {...rest}>
            {children}
        </div>
    );
}