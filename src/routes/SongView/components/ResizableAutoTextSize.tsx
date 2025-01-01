import { updateTextSize } from "auto-text-size";
import {
    useCallback,
    useLayoutEffect,
    useRef
} from "react";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { useDebounce } from "@uidotdev/usehooks";


function AutoTextSizeComputer({
    fitMode,
    twoColumns,
    repeatParts,
    repeatPartsChords,
    chordSettings,
    minFontSizePx,
    maxFontSizePx,
    fontSizePrecisionPx = 0.1,
    setFontSize,
    children,
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
    }, [updateSize, twoColumns, repeatParts, repeatPartsChords, chordSettings]);


    return (
        <div ref={innerElRef} className="invisible absolute">
            {children}
        </div>
    );
}


export function ResizableAutoTextSize({
    minFontSizePx,
    maxFontSizePx,
    children,
}) {
    const { layout, chords: chordSettings, actions } = useViewSettingsStore();
    const setFontSize = useCallback((fontSize: number) => {
        actions.setLayoutSettings({ fontSize })
    }, [actions]);

    return (
        <>
            {layout.fitScreenMode !== "none" && (
                <AutoTextSizeComputer
                    fitMode={layout.fitScreenMode}
                    twoColumns={layout.twoColumns}
                    repeatParts={layout.repeatParts}
                    repeatPartsChords={layout.repeatPartsChords}
                    chordSettings={chordSettings}
                    setFontSize={setFontSize}
                    minFontSizePx={minFontSizePx}
                    maxFontSizePx={maxFontSizePx}
                >
                    {children}
                </AutoTextSizeComputer>
            )}
            <div style={{ fontSize: layout.fontSize }}>
                {children}
            </div>
        </>
    );
};


export default ResizableAutoTextSize;