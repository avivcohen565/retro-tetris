// Canvas rendering with chunky NES-style blocks. All drawing is on integer
// pixel coordinates with smoothing disabled so it stays crisp when scaled.

import { COLS, ROWS, HIDDEN_ROWS, PIECES } from './constants.js';
import { cellsOf, ghostRow } from './engine.js';

export const CELL = 24;

// Classic NES/Game Boy-inspired block colours: base, highlight, shadow.
export const COLORS = {
  I: { base: '#38c8e8', light: '#a8f0ff', dark: '#1a6c88' },
  O: { base: '#f8d820', light: '#fff8a0', dark: '#8c7000' },
  T: { base: '#b040d8', light: '#e8a0ff', dark: '#5a1878' },
  S: { base: '#48d038', light: '#b0ff98', dark: '#1c6c18' },
  Z: { base: '#e83828', light: '#ffa090', dark: '#7c1810' },
  J: { base: '#3858e8', light: '#a0b0ff', dark: '#182878' },
  L: { base: '#f89020', light: '#ffd090', dark: '#884000' },
};

const BG = '#0f380f';
const GRID = '#1a4a1a';
const GHOST = '#306230';

function setup(ctx) {
  ctx.imageSmoothingEnabled = false;
}

export function drawBlock(ctx, x, y, type, size = CELL) {
  const c = COLORS[type];
  const b = Math.max(2, Math.floor(size / 8)); // bevel thickness
  ctx.fillStyle = c.dark;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = c.light;
  ctx.fillRect(x, y, size - b, size - b);
  ctx.fillStyle = c.base;
  ctx.fillRect(x + b, y + b, size - b * 2, size - b * 2);
  // inner pixel glint, top-left
  ctx.fillStyle = c.light;
  ctx.fillRect(x + b, y + b, b, b);
  // outer 1px outline for that sprite-sheet look
  ctx.fillStyle = BG;
  ctx.fillRect(x, y + size - 1, size, 1);
  ctx.fillRect(x + size - 1, y, 1, size);
}

function drawGhostBlock(ctx, x, y, size = CELL) {
  ctx.fillStyle = GHOST;
  ctx.fillRect(x, y, size, 2);
  ctx.fillRect(x, y + size - 3, size, 2);
  ctx.fillRect(x, y, 2, size);
  ctx.fillRect(x + size - 3, y, 2, size);
}

export function drawBoard(ctx, state, { flashRows = [], flashOn = false } = {}) {
  setup(ctx);
  const w = COLS * CELL;
  const h = ROWS * CELL;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  // faint grid dots (a nod to the DMG's LCD pixel grid)
  ctx.fillStyle = GRID;
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) ctx.fillRect(c * CELL, r * CELL, 1, 1);

  // locked cells
  for (let r = HIDDEN_ROWS; r < state.board.length; r++) {
    const vy = (r - HIDDEN_ROWS) * CELL;
    const flashing = flashRows.includes(r);
    for (let c = 0; c < COLS; c++) {
      const t = state.board[r][c];
      if (!t) continue;
      if (flashing) {
        ctx.fillStyle = flashOn ? '#ffffff' : BG;
        ctx.fillRect(c * CELL, vy, CELL, CELL);
      } else {
        drawBlock(ctx, c * CELL, vy, t);
      }
    }
  }

  if (state.current && state.status !== 'over') {
    // ghost
    const gr = ghostRow(state);
    if (gr !== null && gr !== state.current.row) {
      for (const [r, c] of cellsOf({ ...state.current, row: gr })) {
        if (r < HIDDEN_ROWS) continue;
        drawGhostBlock(ctx, c * CELL, (r - HIDDEN_ROWS) * CELL);
      }
    }
    // active piece
    for (const [r, c] of cellsOf(state.current)) {
      if (r < HIDDEN_ROWS) continue;
      drawBlock(ctx, c * CELL, (r - HIDDEN_ROWS) * CELL, state.current.type);
    }
  }
}

// Draws a single piece centred in a small preview canvas.
export function drawPreview(ctx, type, canvasSize = 96) {
  setup(ctx);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  if (!type) return;
  const size = 20;
  const shape = PIECES[type].rotations[0];
  const rows = shape.map(([r]) => r);
  const cols = shape.map(([, c]) => c);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  const pw = (maxC - minC + 1) * size;
  const ph = (maxR - minR + 1) * size;
  const ox = Math.floor((canvasSize - pw) / 2);
  const oy = Math.floor((canvasSize - ph) / 2);
  for (const [r, c] of shape) drawBlock(ctx, ox + (c - minC) * size, oy + (r - minR) * size, type, size);
}
