import { getFontSizeInRange, type LayoutSettings } from "../hooks/viewSettingsStore";
import { getElementFontSize, setElementFontSize } from "./fontSize";

function chooseColumns(
  single: DOMRect,
  width: number,
  height: number,
  gap: number,
  fontSize: number,
) {
  let bestSize = 0;
  let bestColumns = 1;
  for (let columns = 1; columns <= 4; columns++) {
    const scale = Math.min(
      width / (single.width * columns + gap * (columns - 1)),
      height / Math.ceil(single.height / columns),
    );
    const size = getFontSizeInRange(scale * fontSize);
    if (size <= bestSize * 1.1) break;
    bestSize = size;
    bestColumns = columns;
  }
  return bestColumns;
}

export function fitSong(
  content: HTMLElement,
  width: number,
  height: number,
  layout: LayoutSettings,
) {
  const sheet = content.querySelector<HTMLElement>("#song-content-wrapper");
  if (!sheet || width <= 0) return;

  const mode = layout.fitScreenMode;
  const smart = layout.multiColumns && layout.smartColumns;
  if (mode === "none") {
    if (!smart) sheet.style.columnCount = layout.multiColumns ? "2" : "1";
    return;
  }
  if (mode === "fitXY" && height <= 0) return;

  let fontSize = getElementFontSize(content);
  content.classList.add("measuring-container");
  try {
    sheet.style.columnCount = layout.multiColumns && !smart && mode === "fitXY" ? "2" : "1";
    let bounds = content.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    if (smart && mode === "fitXY") {
      const columns = chooseColumns(bounds, width, height, parseFloat(getComputedStyle(sheet).columnGap), fontSize);
      if (columns > 1) {
        sheet.style.columnCount = String(columns);
        bounds = content.getBoundingClientRect();
      }
    }

    // Fixed gaps and heading margins do not scale with the font. Correct the
    // estimate once at its new size, without repeating the column search.
    for (let pass = 0; pass < 2; pass++) {
      const scale = mode === "fitX" ? width / bounds.width
        : Math.min(width / bounds.width, height / bounds.height);
      const size = getFontSizeInRange(scale * fontSize);
      if (Math.abs(size - fontSize) <= 0.1) break;
      setElementFontSize(content, size);
      fontSize = size;
      if (pass === 0) bounds = content.getBoundingClientRect();
    }
  } finally {
    content.classList.remove("measuring-container");
  }
}
