// Device-specific layout: picks a mode (phone / tablet / desktop) and sizes
// the board so it fills the available viewport comfortably in each one.
// Pure functions — the DOM is touched only by applyLayout().

import { COLS, ROWS } from './constants.js';

export const MODES = ['phone', 'tablet', 'desktop'];

// Chooses the layout mode. `override` (from ?layout= or a saved preference)
// wins; otherwise touch devices are phone/tablet by their shorter side, and
// anything with a fine pointer (mouse/trackpad) is desktop.
export function detectMode({ width, height, touch, finePointer = false, override = null }) {
  if (override && MODES.includes(override)) return override;
  if (!touch || finePointer) return 'desktop';
  return Math.min(width, height) < 600 ? 'phone' : 'tablet';
}

// Space around the board expressed as linear constraints: the board cell must
// satisfy cell <= (viewport - fixed) / k on each axis. `k` counts the board
// (10 x 20 cells) plus HUD panels measured in cells; `fixed` is chrome in px
// (header, buttons, paddings). The fit is re-checked against the real DOM by
// main.js, so these only need to be close.
const SPECS = {
  phone: {
    portrait:  { fixedW: 44,  kW: 10, fixedH: 236, kH: 23.5 },
    landscape: { fixedW: 330, kW: 17, fixedH: 76,  kH: 20 },
    min: 12, max: 40, btn: 44, ab: 54, pad: 8, gap: 6, previewCells: 3, panelCells: 3.5,
  },
  tablet: {
    portrait:  { fixedW: 96,  kW: 19, fixedH: 380, kH: 20 },
    landscape: { fixedW: 560, kW: 19, fixedH: 130, kH: 20 },
    min: 20, max: 64, btn: 76, ab: 92, pad: 14, gap: 10, previewCells: 4, panelCells: 4.5,
  },
  desktop: {
    portrait:  { fixedW: 96, kW: 19, fixedH: 170, kH: 20 },
    landscape: { fixedW: 96, kW: 19, fixedH: 170, kH: 20 },
    min: 12, max: 44, btn: 0, ab: 0, pad: 16, gap: 10, previewCells: 4, panelCells: 4.5,
  },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function computeLayout(mode, width, height, dpr = 1, { maxCell = Infinity } = {}) {
  const spec = SPECS[mode] ?? SPECS.desktop;
  const orientation = width >= height ? 'landscape' : 'portrait';
  const s = spec[orientation];
  const byWidth = (width - s.fixedW) / s.kW;
  const byHeight = (height - s.fixedH) / s.kH;
  const cell = clamp(Math.floor(Math.min(byWidth, byHeight, maxCell)), spec.min, spec.max);
  const cellPx = Math.max(1, Math.round(cell * dpr));
  return {
    mode,
    orientation,
    cell,
    cellPx,
    dpr,
    boardWidth: COLS * cell,
    boardHeight: ROWS * cell,
    previewCells: spec.previewCells,
    panelCells: spec.panelCells,
    fonts: {
      xs: Math.max(7, Math.round(cell * 0.3)),
      s: Math.max(8, Math.round(cell * 0.4)),
      m: Math.max(10, Math.round(cell * 0.55)),
      l: Math.max(12, Math.round(cell * 0.7)),
    },
    btn: spec.btn,
    ab: spec.ab,
    pad: spec.pad,
    gap: spec.gap,
  };
}

// Writes the layout into CSS custom properties and canvas sizes.
export function applyLayout(layout, { root, board, next, hold }) {
  const st = root.style;
  root.dataset.layout = layout.mode;
  root.dataset.orientation = layout.orientation;
  st.setProperty('--cell', `${layout.cell}px`);
  st.setProperty('--panel-cells', String(layout.panelCells));
  st.setProperty('--fs-xs', `${layout.fonts.xs}px`);
  st.setProperty('--fs-s', `${layout.fonts.s}px`);
  st.setProperty('--fs-m', `${layout.fonts.m}px`);
  st.setProperty('--fs-l', `${layout.fonts.l}px`);
  st.setProperty('--btn', `${layout.btn}px`);
  st.setProperty('--ab', `${layout.ab}px`);
  st.setProperty('--pad', `${layout.pad}px`);
  st.setProperty('--gap', `${layout.gap}px`);

  sizeCanvas(board, COLS * layout.cellPx, ROWS * layout.cellPx, layout.boardWidth, layout.boardHeight);
  const previewCss = layout.previewCells * layout.cell;
  const previewPx = layout.previewCells * layout.cellPx;
  sizeCanvas(next, previewPx, previewPx, previewCss, previewCss);
  sizeCanvas(hold, previewPx, previewPx, previewCss, previewCss);
}

function sizeCanvas(canvas, w, h, cssW, cssH) {
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}

// Block size used inside the preview canvases.
export function previewBlock(layout) {
  return Math.max(4, Math.floor(layout.cellPx * (layout.previewCells >= 4 ? 0.75 : 0.6)));
}
