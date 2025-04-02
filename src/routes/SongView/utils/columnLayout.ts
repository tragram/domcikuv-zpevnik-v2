import { FitScreenMode, LayoutSettings, getFontSizeInRange } from "../hooks/viewSettingsStore";
import { getElementFontSize, setElementFontSize } from "./fontSize";

const HIGHER_COL_RATIO = 1.1; // How many times larger font size needs to be in more columns to justify the switch
const IGNORE_DIFF_PX = 0.1;  // due to text not scaling exactly, resize may lead to a different optimal font size and that could lead to an infinite loop --> ignore these tiny changes

/**
 * Finds the optimal number of columns for content layout
 */
export function setOptimalColumnCount(
  content: HTMLElement | null,
  container: HTMLElement | null,
  layout: LayoutSettings,
  minColumns: number = 1,
  maxColumns: number = 4,
  colElId: string = '#song-content-wrapper'
): number {
  let columnCount;
  const child = content?.querySelector(colElId) as HTMLElement;
  if (!child) {
    throw Error("Song content wrapper not found!");
  }

  // Safety checks for null elements
  if (!content || !container) {
    columnCount = 1;
  } else if (!layout.multiColumns || layout.fitScreenMode === "fitX") {
    // fitX always has the optimal solution as one
    columnCount = 1;
  } else if (!layout.smartColumns) {
    columnCount = 2;
  } else if (layout.fitScreenMode === "none") {
    return parseFloat(child.style.columnCount);
  } else if (layout.fitScreenMode !== "fitXY") {
    console.error("Error: Unknown fit screen mode!");
    columnCount = 1;
  } else {
    let bestFontSize = 0;
    let bestColumns = 1;

    try {
      // First measure single-column layout to establish baseline
      child.style.columnCount = '1';

      const singleColRect = content.getBoundingClientRect();
      const baseWidth = singleColRect.width;
      const baseHeight = singleColRect.height;

      // Skip further calculations if we have invalid measurements
      if (baseWidth <= 0 || baseHeight <= 0) {
        return 1;
      }

      const columnGap = parseFloat(getComputedStyle(child).getPropertyValue("column-gap"));
      const containerRect = container.getBoundingClientRect();

      // Use approximation to estimate multi-column layouts
      for (let cols = minColumns; cols <= maxColumns; cols++) {
        // Approximate dimensions for this column count
        // Width increases roughly linearly with column count (accounting for gaps)
        const approxWidth = baseWidth * cols + (columnGap * (cols - 1));

        // Height decreases roughly proportionally with column count
        // This approximation assumes content distributes fairly evenly
        const approxHeight = Math.ceil(baseHeight / cols);

        // Calculate font size based on approximated dimensions
        const widthScale = containerRect.width / approxWidth;
        const heightScale = containerRect.height / approxHeight;
        const calculatedFontSize = getFontSizeInRange(
          Math.min(widthScale, heightScale) * getElementFontSize(content)
        );

        // Update if this configuration allows a larger font size
        if (calculatedFontSize > HIGHER_COL_RATIO * bestFontSize) {
          bestFontSize = calculatedFontSize;
          bestColumns = cols;
        } else {
          // If font size is decreasing, we've found the optimal column count
          break;
        }
      }
      columnCount = bestColumns;
    } catch (error) {
      console.error("Error calculating optimal column count:", error);
      columnCount = 1; // Default to 1 column in case of error
    }
  }

  child.style.columnCount = columnCount.toString();
  return columnCount;
}

/**
 * Calculates font size based on content dimensions and container dimensions
 */
function calculateFontSize(
  contentRect: DOMRect,
  containerRect: DOMRect,
  fitMode: FitScreenMode,
  fontSize: number,
): number {
  if (fitMode === 'fitXY') {
    const widthScale = containerRect.width / contentRect.width * fontSize;
    const heightScale = containerRect.height / contentRect.height * fontSize;
    return getFontSizeInRange(Math.min(widthScale, heightScale));
  } else if (fitMode === 'fitX') {
    const widthScale = containerRect.width / contentRect.width * fontSize;
    return getFontSizeInRange(widthScale);
  }
  // no change for fitMode 'none'
  return fontSize;
}


/**
 * Sets font size based on content and container dimensions for a specific fit mode
 */
export function setFontSize(
  content: HTMLElement | null,
  container: HTMLElement | null,
  fitMode: FitScreenMode,
): number {
  // Safety checks
  if (!content || !container) {
    return getElementFontSize(null);
  }

  try {
    // Get precise content size for the selected column count
    const contentRect = content.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate font size with precise measurements
    const currentFontSize = getElementFontSize(content);
    const newFontSize = calculateFontSize(contentRect, containerRect, fitMode, currentFontSize);
    if (Math.abs(currentFontSize - newFontSize) > IGNORE_DIFF_PX) {
      setElementFontSize(content, newFontSize);
    }
    return newFontSize;
  } catch (error) {
    console.error("Error calculating precise font size:", error);
    return getElementFontSize(null); // Default in case of error
  }
}
