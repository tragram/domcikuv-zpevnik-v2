import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoTextSizeOptions = {
  mode?: "oneline" | "multiline" | "box" | "boxoneline";
  minFontSizePx?: number;
  maxFontSizePx?: number;
  fontSizePrecisionPx?: number;
};

export function useAutoTextSize({
  mode = "multiline",
  minFontSizePx = 8,
  maxFontSizePx = 160,
  fontSizePrecisionPx = 0.1,
}: AutoTextSizeOptions = {}) {
  const [fontSize, setFontSize] = useState<number>(maxFontSizePx);
  const innerRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number>();

  const getContentWidth = useCallback((element: HTMLElement): number => {
    const computedStyle = getComputedStyle(element);
    return (
      element.clientWidth -
      parseFloat(computedStyle.paddingLeft) -
      parseFloat(computedStyle.paddingRight)
    );
  }, []);

  const getContentHeight = useCallback((element: HTMLElement): number => {
    const computedStyle = getComputedStyle(element);
    return (
      element.clientHeight -
      parseFloat(computedStyle.paddingTop) -
      parseFloat(computedStyle.paddingBottom)
    );
  }, []);

  const updateFontSize = useCallback((px: number): number => {
    px = Math.min(Math.max(px, minFontSizePx), maxFontSizePx);
    setFontSize(px);
    return px;
  }, [maxFontSizePx, minFontSizePx]);

  const antiOverflowAlgo = useCallback(({
    currentFontSize,
    breakPredicate,
  }: {
    currentFontSize: number;
    breakPredicate: () => boolean;
  }): number => {
    const maxIterCount = Math.ceil(1 / fontSizePrecisionPx);
    let iterCount = 0;
    let fontSize = currentFontSize;

    while (fontSize > minFontSizePx && iterCount < maxIterCount) {
      if (breakPredicate()) break;
      fontSize = updateFontSize(fontSize - fontSizePrecisionPx);
      iterCount++;
    }

    return fontSize;
  }, [fontSizePrecisionPx, minFontSizePx, updateFontSize]);

  const onelineAlgo = useCallback(({
    innerEl,
    containerEl,
    initialFontSize,
  }: {
    innerEl: HTMLElement;
    containerEl: HTMLElement;
    initialFontSize: number;
  }): number => {
    const maxIterCount = 10;
    let iterCount = 0;
    let prevOverflowFactor = 1;
    let currentFontSize = initialFontSize;

    while (iterCount < maxIterCount) {
      const w0 = innerEl.scrollWidth;
      const w1 = getContentWidth(containerEl);

      const canGrow = currentFontSize < maxFontSizePx && w0 < w1;
      const canShrink = currentFontSize > minFontSizePx && w0 > w1;

      const overflowFactor = w0 / w1;

      if (prevOverflowFactor === overflowFactor) break;
      if (!(canGrow || canShrink)) break;

      const updatePx = currentFontSize / overflowFactor - currentFontSize;
      const prevFontSize = currentFontSize;
      currentFontSize = updateFontSize(currentFontSize + updatePx);

      if (Math.abs(currentFontSize - prevFontSize) <= fontSizePrecisionPx) {
        break;
      }

      prevOverflowFactor = overflowFactor;
      iterCount++;
    }

    return antiOverflowAlgo({
      currentFontSize,
      breakPredicate: () => innerEl.scrollWidth <= getContentWidth(containerEl),
    });
  }, [antiOverflowAlgo, fontSizePrecisionPx, getContentWidth, maxFontSizePx, minFontSizePx, updateFontSize]);

  const multilineAlgo = useCallback(({
    innerEl,
    containerEl,
    initialFontSize,
  }: {
    innerEl: HTMLElement;
    containerEl: HTMLElement;
    initialFontSize: number;
  }): number => {
    innerEl.style.whiteSpace = "nowrap";
    const finalFontSize = onelineAlgo({ innerEl, containerEl, initialFontSize });

    if (innerEl.scrollWidth > getContentWidth(containerEl)) {
      innerEl.style.whiteSpace = "normal";
    }

    return finalFontSize;
  }, [getContentWidth, onelineAlgo]);

  const boxAlgo = useCallback(({
    innerEl,
    containerEl,
    initialFontSize,
  }: {
    innerEl: HTMLElement;
    containerEl: HTMLElement;
    initialFontSize: number;
  }): number => {
    const maxIterCount = 100;
    let currentFontSize = updateFontSize((maxFontSizePx - minFontSizePx) * 0.5);
    let updatePx = (maxFontSizePx - minFontSizePx) * 0.25;
    let iterCount = 0;

    while (updatePx > fontSizePrecisionPx && iterCount < maxIterCount) {
      const w0 = innerEl.scrollWidth;
      const w1 = getContentWidth(containerEl);
      const h0 = innerEl.scrollHeight;
      const h1 = getContentHeight(containerEl);

      if (w0 === w1 && h0 === h1) break;

      if (currentFontSize < maxFontSizePx && w0 <= w1 && h0 <= h1) {
        currentFontSize = updateFontSize(currentFontSize + updatePx);
      } else if (currentFontSize > minFontSizePx && (w0 > w1 || h0 > h1)) {
        currentFontSize = updateFontSize(currentFontSize - updatePx);
      }

      updatePx *= 0.5;
      iterCount++;
    }

    return antiOverflowAlgo({
      currentFontSize,
      breakPredicate: () =>
        innerEl.scrollWidth <= getContentWidth(containerEl) &&
        innerEl.scrollHeight <= getContentHeight(containerEl),
    });
  }, [antiOverflowAlgo, fontSizePrecisionPx, getContentHeight, getContentWidth, maxFontSizePx, minFontSizePx, updateFontSize]);

  const updateTextSize = useCallback(() => {
    if (!innerRef.current || !containerRef.current) return;

    const innerEl = innerRef.current;
    const containerEl = containerRef.current;

    if (!isFinite(minFontSizePx)) {
      throw new Error(`Invalid minFontSizePx (${minFontSizePx})`);
    }

    if (!isFinite(maxFontSizePx)) {
      throw new Error(`Invalid maxFontSizePx (${maxFontSizePx})`);
    }

    if (!isFinite(fontSizePrecisionPx) || fontSizePrecisionPx === 0) {
      throw new Error(`Invalid fontSizePrecisionPx (${fontSizePrecisionPx})`);
    }

    const containerStyles: Partial<CSSStyleDeclaration> = {
      display: "flex",
      alignItems: "start",
    };

    const innerStyles: Partial<CSSStyleDeclaration> = {
      display: "block",
    };

    if (mode === "oneline") {
      innerStyles.whiteSpace = "nowrap";
    } else if (mode === "multiline") {
      innerStyles.wordBreak = "break-word";
    } else if (mode === "box") {
      innerStyles.whiteSpace = "pre-wrap";
      innerStyles.wordBreak = "break-word";
    } else if (mode === "boxoneline") {
      innerStyles.whiteSpace = "nowrap";
    }

    Object.assign(containerEl.style, containerStyles);
    Object.assign(innerEl.style, innerStyles);

    const fontSizeStr = window
      .getComputedStyle(innerEl, null)
      .getPropertyValue("font-size");
    let initialFontSize = parseFloat(fontSizeStr);

    if (initialFontSize > maxFontSizePx || initialFontSize < minFontSizePx) {
      initialFontSize = updateFontSize(initialFontSize);
    }

    if (mode === "oneline") {
      onelineAlgo({ innerEl, containerEl, initialFontSize });
    } else if (mode === "multiline") {
      multilineAlgo({ innerEl, containerEl, initialFontSize });
    } else if (mode === "box" || mode === "boxoneline") {
      boxAlgo({ innerEl, containerEl, initialFontSize });
    }
  }, [
    mode,
    minFontSizePx,
    maxFontSizePx,
    fontSizePrecisionPx,
    updateFontSize,
    onelineAlgo,
    multilineAlgo,
    boxAlgo,
  ]);

  useEffect(() => {
    if (!innerRef.current || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(updateTextSize);
    });

    resizeObserver.observe(containerRef.current);
    updateTextSize();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [updateTextSize]);

  return {
    fontSize,
    innerRef,
    containerRef,
    updateTextSize
  };
}