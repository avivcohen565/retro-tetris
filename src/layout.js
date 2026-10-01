// Device-specific layout: picks a mode (phone / tablet / desktop) and sizes
// the board so it fills the viewport comfortably on each one.
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

// Each orientation lists one or more HUD arrangements. For each, the board
// cell must satisfy cell <= (viewport - fixed) / k on both axes: `k` counts
// the board (10 x 20 cells) plus HUD panels in cells, `fixed` is chrome in px.
// Touch controls add dpadH x btn (portrait) or dpadW x btn + abW x ab
// (landscape). The arrangement giving the biggest cell wins; main.js then
// re-checks against the real DOM, so these only need to be close.
const SPECS = {
  phone: {
    min: 12, max: 40, pad: 8, gap: 6, fsMin: 8,
    previewCells: 2.6, panelCells: 3.6,
    btnMin: 38, btnMax: 46, btnReserve: 112, abRatio: 1.2,
    portrait: [
      { hud: 'strip', fixedW: 44, kW: 10, fixedH: 108, kH: 23.6, dpadH: 3 },
      { hud: 'side', fixedW: 56, kW: 17.2, fixedH: 108, kH: 20, dpadH: 3 },
    ],
    landscape: [{ hud: 'side', fixedW: 100, kW: 17.2, fixedH: 56, kH: 20, dpadW: 3, abW: 1.6 }],
  },
  tablet: {
    min: 20, max: 64, pad: 14, gap: 10, fsMin: 10,
    previewCells: 3.6, panelCells: 4.5,
    btnMin: 56, btnMax: 80, btnReserve: 160, abRatio: 1.2,
    portrait: [{ hud: 'side', fixedW: 96, kW: 19, fixedH: 150, kH: 20, dpadH: 3 }],
    landscape: [{ hud: 'side', fixedW: 180, kW: 19, fixedH: 130, kH: 20, dpadW: 3, abW: 1.6 }],
  },
  desktop: {
    min: 12, max: 44, pad: 16, gap: 10, fsMin: 9,
    previewCells: 4, panelCells: 5,
    btnMin: 0, btnMax: 0, btnReserve: 0, abRatio: 0,
    portrait: [{ hud: 'side', fixedW: 106, kW: 20, fixedH: 150, kH: 20 }],
    landscape: [{ hud: 'side', fixedW: 106, kW: 20, fixedH: 150, kH: 20 }],
  },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// D-pad arm size: as big as the screen width allows (D-pad + pills + A/B in
// one row on a portrait phone), within thumb-friendly bounds.
function buttonSize(spec, width) {
  if (!spec.btnMax) return 0;
  return clamp(Math.floor((width - spec.btnReserve) / 5.4), spec.btnMin, spec.btnMax);
}

export function computeLayout(mode, width, height, dpr = 1, { maxCell = Infinity } = {}) {
  const spec = SPECS[mode] ?? SPECS.desktop;
  const orientation = width >= height ? 'landscape' : 'portrait';
  const btn = buttonSize(spec, width);
  const ab = Math.round(btn * spec.abRatio);

  let best = null;
  for (const v of spec[orientation]) {
    const fixedW = v.fixedW + (v.dpadW ?? 0) * btn + (v.abW ?? 0) * ab;
    const fixedH = v.fixedH + (v.dpadH ?? 0) * btn;
    const fit = Math.floor(Math.min((width - fixedW) / v.kW, (height - fixedH) / v.kH, maxCell));
    if (!best || fit > best.fit) best = { hud: v.hud, fit };
  }

  const cell = clamp(best.fit, spec.min, spec.max);
  const cellPx = Math.max(1, Math.round(cell * dpr));
  // Preview canvases must fit inside their panel (minus padding + borders).
  const previewCss = Math.floor(Math.min(spec.previewCells * cell, spec.panelCells * cell - 1.6 * spec.gap - 7));
  const fs = (k, extra) => Math.max(spec.fsMin + extra, Math.round(cell * k));

  return {
    mode,
    orientation,
    hud: best.hud,
    cell,
    cellPx,
    dpr,
    boardWidth: COLS * cell,
    boardHeight: ROWS * cell,
    previewCss,
    previewPx: Math.max(1, Math.round(previewCss * dpr)),
    panelCells: spec.panelCells,
    fonts: {
      xs: fs(0.36, 0),
      s: fs(0.46, 2),
      m: fs(0.6, 4),
      l: fs(0.78, 7),
      btn: clamp(Math.round(cell * 0.46), 8, 22),
    },
    btn,
    ab,
    pad: spec.pad,
    gap: spec.gap,
  };
}

// Writes the layout into CSS custom properties, data attributes and canvases.
export function applyLayout(layout, { root, board, next, hold }) {
  const st = root.style;
  const px = (v) => `${v}px`;
  root.dataset.layout = layout.mode;
  root.dataset.orientation = layout.orientation;
  root.dataset.hud = layout.hud;
  st.setProperty('--cell', px(layout.cell));
  st.setProperty('--panel-cells', String(layout.panelCells));
  for (const [name, size] of Object.entries(layout.fonts)) st.setProperty(`--fs-${name}`, px(size));
  st.setProperty('--btn', px(layout.btn));
  st.setProperty('--ab', px(layout.ab));
  st.setProperty('--pad', px(layout.pad));
  st.setProperty('--gap', px(layout.gap));

  sizeCanvas(board, COLS * layout.cellPx, ROWS * layout.cellPx, layout.boardWidth, layout.boardHeight);
  sizeCanvas(next, layout.previewPx, layout.previewPx, layout.previewCss, layout.previewCss);
  sizeCanvas(hold, layout.previewPx, layout.previewPx, layout.previewCss, layout.previewCss);
}

function sizeCanvas(canvas, w, h, cssW, cssH) {
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}

// Block size inside the preview canvases: an I piece spans 4/5 of the width.
export function previewBlock(layout) {
  return Math.max(4, Math.floor(layout.previewPx / 5));
}
