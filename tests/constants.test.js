import { describe, it, expect } from 'vitest';
import { PIECES, PIECE_TYPES, gravityForLevel, GRAVITY_MS, MIN_GRAVITY_MS } from '../src/constants.js';

describe('piece definitions', () => {
  it('has the 7 classic tetrominoes', () => {
    expect(PIECE_TYPES.sort()).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  });

  it('every rotation has exactly 4 distinct cells within a 4x4 box', () => {
    for (const type of PIECE_TYPES) {
      expect(PIECES[type].rotations).toHaveLength(4);
      for (const rot of PIECES[type].rotations) {
        expect(rot).toHaveLength(4);
        const keys = new Set(rot.map(([r, c]) => `${r},${c}`));
        expect(keys.size).toBe(4);
        for (const [r, c] of rot) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(4);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(4);
        }
      }
    }
  });
});

describe('gravity', () => {
  it('speeds up as level increases', () => {
    expect(gravityForLevel(0)).toBe(GRAVITY_MS[0]);
    expect(gravityForLevel(5)).toBeLessThan(gravityForLevel(0));
    expect(gravityForLevel(999)).toBe(GRAVITY_MS[GRAVITY_MS.length - 1]);
    expect(gravityForLevel(999)).toBeGreaterThanOrEqual(MIN_GRAVITY_MS);
  });
});
