import { describe, it, expect } from 'vitest';
import { MODES, detectMode, computeLayout, applyLayout, previewBlock } from '../src/layout.js';
import { COLS, ROWS } from '../src/constants.js';

describe('detectMode', () => {
  it('honours a valid override and ignores an invalid one', () => {
    expect(detectMode({ width: 1400, height: 900, touch: false, override: 'phone' })).toBe('phone');
    expect(detectMode({ width: 390, height: 844, touch: true, override: 'nope' })).toBe('phone');
  });

  it('is desktop without touch or with a fine pointer', () => {
    expect(detectMode({ width: 1440, height: 900, touch: false })).toBe('desktop');
    expect(detectMode({ width: 1024, height: 1366, touch: true, finePointer: true })).toBe('desktop');
  });

  it('classifies iPhones as phone in both orientations', () => {
    expect(detectMode({ width: 390, height: 844, touch: true })).toBe('phone');
    expect(detectMode({ width: 844, height: 390, touch: true })).toBe('phone');
    expect(detectMode({ width: 430, height: 932, touch: true })).toBe('phone');
  });

  it('classifies iPads as tablet in both orientations', () => {
    expect(detectMode({ width: 1024, height: 1366, touch: true })).toBe('tablet');
    expect(detectMode({ width: 1366, height: 1024, touch: true })).toBe('tablet');
    expect(detectMode({ width: 744, height: 1133, touch: true })).toBe('tablet');
  });
});

describe('computeLayout', () => {
  const cases = [
    ['iPhone 14 portrait', 'phone', 390, 844, 3],
    ['iPhone 14 landscape', 'phone', 844, 390, 3],
    ['iPhone SE portrait', 'phone', 375, 667, 2],
    ['iPad Pro 13 portrait', 'tablet', 1024, 1366, 2],
    ['iPad Pro 13 landscape', 'tablet', 1366, 1024, 2],
    ['desktop 1440x800', 'desktop', 1440, 800, 2],
    ['desktop small window', 'desktop', 800, 600, 1],
  ];

  it.each(cases)('%s fits the board inside the viewport', (_, mode, w, h, dpr) => {
    const l = computeLayout(mode, w, h, dpr);
    expect(l.mode).toBe(mode);
    expect(l.orientation).toBe(w >= h ? 'landscape' : 'portrait');
    expect(l.boardWidth).toBe(COLS * l.cell);
    expect(l.boardHeight).toBe(ROWS * l.cell);
    expect(l.boardWidth).toBeLessThan(w);
    expect(l.boardHeight).toBeLessThan(h);
    expect(l.cellPx).toBe(Math.round(l.cell * dpr));
    expect(Number.isInteger(l.cell)).toBe(true);
  });

  it('gives the iPad a much bigger board than the phone', () => {
    const phone = computeLayout('phone', 390, 844, 3);
    const tablet = computeLayout('tablet', 1024, 1366, 2);
    expect(tablet.cell).toBeGreaterThanOrEqual(phone.cell * 1.6);
    expect(tablet.btn).toBeGreaterThan(phone.btn);
    expect(tablet.ab).toBeGreaterThan(phone.ab);
  });

  it('leaves room for touch controls on the phone but not on desktop', () => {
    // Same portrait, height-limited viewport: the phone reserves space for buttons.
    const phone = computeLayout('phone', 900, 1000, 1);
    const desktop = computeLayout('desktop', 900, 1000, 1);
    expect(phone.btn).toBeGreaterThan(0);
    expect(desktop.btn).toBe(0);
    expect(phone.boardHeight).toBeLessThan(desktop.boardHeight);
  });

  it('respects maxCell and the mode bounds', () => {
    const l = computeLayout('tablet', 1366, 1024, 2, { maxCell: 30 });
    expect(l.cell).toBe(30);
    const tiny = computeLayout('tablet', 200, 200, 1);
    expect(tiny.cell).toBe(20); // clamped to the tablet minimum
    const huge = computeLayout('desktop', 5000, 5000, 1);
    expect(huge.cell).toBe(44); // clamped to the desktop maximum
  });

  it('scales fonts with the cell and keeps them readable', () => {
    for (const mode of MODES) {
      const small = computeLayout(mode, 320, 480, 1);
      const big = computeLayout(mode, 2000, 2000, 1);
      expect(small.fonts.xs).toBeGreaterThanOrEqual(7);
      expect(big.fonts.l).toBeGreaterThan(big.fonts.m);
      expect(big.fonts.m).toBeGreaterThan(big.fonts.s);
      expect(big.fonts.s).toBeGreaterThan(big.fonts.xs);
      expect(big.fonts.xs).toBeGreaterThanOrEqual(small.fonts.xs);
    }
  });
});

describe('applyLayout', () => {
  function fakeCanvas() { return { width: 0, height: 0, style: {} }; }
  function fakeRoot() {
    const vars = {};
    return { dataset: {}, style: { setProperty: (k, v) => { vars[k] = v; } }, vars };
  }

  it('writes CSS variables, data attributes and canvas sizes', () => {
    const root = fakeRoot();
    const board = fakeCanvas(), next = fakeCanvas(), hold = fakeCanvas();
    const l = computeLayout('tablet', 1024, 1366, 2);
    applyLayout(l, { root, board, next, hold });
    expect(root.dataset.layout).toBe('tablet');
    expect(root.dataset.orientation).toBe('portrait');
    expect(root.vars['--cell']).toBe(`${l.cell}px`);
    expect(root.vars['--btn']).toBe(`${l.btn}px`);
    expect(board.width).toBe(COLS * l.cellPx);
    expect(board.height).toBe(ROWS * l.cellPx);
    expect(board.style.width).toBe(`${COLS * l.cell}px`);
    expect(next.width).toBe(l.previewCells * l.cellPx);
    expect(hold.style.height).toBe(`${l.previewCells * l.cell}px`);
  });

  it('previewBlock fits a 4-wide piece inside the preview canvas', () => {
    for (const mode of MODES) {
      const l = computeLayout(mode, 1000, 1000, 2);
      expect(previewBlock(l) * 4).toBeLessThanOrEqual(l.previewCells * l.cellPx);
    }
  });
});
