const DEFAULT_FONT_SIZE = 16;

/**
 * Gets the current font size of an element
 */
export const getElementFontSize = (element: HTMLElement | null): number => {
  return element ? parseFloat(element.style.fontSize) || DEFAULT_FONT_SIZE : DEFAULT_FONT_SIZE;
};

/**
 * Sets font size on an element with px units
 */
export const setElementFontSize = (element: HTMLElement, fontSize: number) => {
  element.style.fontSize = `${fontSize}px`;
};