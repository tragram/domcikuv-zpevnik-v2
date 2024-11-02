import { AArrowDown, Ruler, AArrowUp, CaseSensitive, Plus, Minus, MoveDiagonal, MoveHorizontal } from "lucide-react";

export const minFontSizePx = 4;
export const maxFontSizePx = 160;
export const fontSizeLimits = (fontSize) => Math.min(Math.max(minFontSizePx, fontSize), maxFontSizePx);