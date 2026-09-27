// Board and timing constants for Retro Tetris.

export const COLS = 10;
export const ROWS = 20;
export const HIDDEN_ROWS = 2; // spawn area above the visible board
export const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

// Tetromino shapes. Each piece has 4 rotation states; each state is a list of
// [row, col] offsets relative to the piece origin.
export const PIECES = {
  I: {
    color: 'I',
    rotations: [
      [[1, 0], [1, 1], [1, 2], [1, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 1], [1, 1], [2, 1], [3, 1]],
    ],
  },
  O: {
    color: 'O',
    rotations: [
      [[0, 1], [0, 2], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [1, 2]],
    ],
  },
  T: {
    color: 'T',
    rotations: [
      [[0, 1], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 1]],
      [[0, 1], [1, 0], [1, 1], [2, 1]],
    ],
  },
  S: {
    color: 'S',
    rotations: [
      [[0, 1], [0, 2], [1, 0], [1, 1]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 1], [1, 2], [2, 0], [2, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]],
    ],
  },
  Z: {
    color: 'Z',
    rotations: [
      [[0, 0], [0, 1], [1, 1], [1, 2]],
      [[0, 2], [1, 1], [1, 2], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[0, 1], [1, 0], [1, 1], [2, 0]],
    ],
  },
  J: {
    color: 'J',
    rotations: [
      [[0, 0], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 0], [2, 1]],
    ],
  },
  L: {
    color: 'L',
    rotations: [
      [[0, 2], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [1, 2], [2, 0]],
      [[0, 0], [0, 1], [1, 1], [2, 1]],
    ],
  },
};

export const PIECE_TYPES = Object.keys(PIECES);

// Simple wall-kick offsets tried in order when a rotation collides.
export const KICKS = [[0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0]];

// NES scoring: points per lines cleared at once, multiplied by (level + 1).
export const LINE_SCORES = [0, 40, 100, 300, 1200];
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
export const LINES_PER_LEVEL = 10;

// Gravity: milliseconds per cell drop, by level (NES-inspired curve).
export const GRAVITY_MS = [800, 717, 633, 550, 467, 383, 300, 217, 133, 100, 83, 83, 83, 67, 67, 67, 50, 50, 50, 33];
export const MIN_GRAVITY_MS = 17;

export function gravityForLevel(level) {
  return GRAVITY_MS[Math.min(level, GRAVITY_MS.length - 1)] ?? MIN_GRAVITY_MS;
}
