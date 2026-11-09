import { STORAGE_KEYS } from "./storage.js";

export const DEFAULT_LAYOUT = { sidebarW: 220, inputFr: 1 };
export const SIDEBAR_MIN = 160;
export const SIDEBAR_MAX = 480;
export const INPUT_FR_MIN = 0.2;
export const INPUT_FR_MAX = 5;
// Width of the resize handle between the input and output panes.
export const RESIZER_PX = 12;
// Minimum width either pane can be dragged down to.
const MIN_PANE_PX = 80;

export function clampSidebarWidth(width) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width));
}

export function clampInputFr(fr) {
  return Math.min(INPUT_FR_MAX, Math.max(INPUT_FR_MIN, fr));
}

// Reads the persisted layout, clamping every value into its allowed range.
export function loadLayout(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEYS.layout);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    const sidebarW = Number(parsed?.sidebarW);
    const inputFr = Number(parsed?.inputFr);
    return {
      sidebarW: Number.isFinite(sidebarW)
        ? clampSidebarWidth(sidebarW)
        : DEFAULT_LAYOUT.sidebarW,
      inputFr:
        Number.isFinite(inputFr) && inputFr > 0
          ? clampInputFr(inputFr)
          : DEFAULT_LAYOUT.inputFr,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// Pixel width of the input pane for a given input/output ratio.
export function inputPxFromFr(inputFr, totalPx) {
  return (inputFr / (inputFr + 1)) * totalPx;
}

// New input/output ratio after dragging the split handle by `dx` pixels.
export function inputFrFromDrag(totalPx, startInputPx, dx) {
  const nextInputPx = Math.min(
    totalPx - MIN_PANE_PX,
    Math.max(MIN_PANE_PX, startInputPx + dx)
  );
  const fr = nextInputPx / Math.max(1, totalPx - nextInputPx);
  return clampInputFr(fr);
}
