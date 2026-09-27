import { describe, it, expect } from 'vitest';
import {
  createGame, start, spawn, moveLeft, moveRight, rotate, softDrop, hardDrop,
  tick, hold, lock, clearLines, applyScore, createBag, cellsOf, collides,
  ghostRow, togglePause, drainEvents, makePiece, createBoard,
} from '../src/engine.js';
import { COLS, TOTAL_ROWS, HIDDEN_ROWS, LINE_SCORES, PIECE_TYPES } from '../src/constants.js';

// Deterministic rng that always yields 0 → bag order stays [I,O,T,S,Z,J,L]
// after Fisher-Yates with j=0 each step (shuffle rotates the array).
const zeroRng = () => 0;

function newGame(rng = zeroRng) {
  const g = start(createGame({ rng }));
  drainEvents(g);
  return g;
}

function fillRow(board, row, { skipCol = null, type = 'O' } = {}) {
  for (let c = 0; c < COLS; c++) if (c !== skipCol) board[row][c] = type;
}

describe('7-bag randomizer', () => {
  it('produces every piece exactly once per bag', () => {
    const bag = createBag(Math.random);
    expect([...bag].sort()).toEqual([...PIECE_TYPES].sort());
  });

  it('never repeats a piece more than twice in a row across bags', () => {
    const g = newGame(Math.random);
    const seq = [g.current.type];
    for (let i = 0; i < 200; i++) {
      hardDrop(g);
      if (g.status === 'over') break;
      seq.push(g.current.type);
    }
    for (let i = 2; i < seq.length; i++) {
      expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
    }
  });
});

describe('game lifecycle', () => {
  it('starts in ready state with a preview piece and no current piece', () => {
    const g = createGame({ rng: zeroRng });
    expect(g.status).toBe('ready');
    expect(g.current).toBeNull();
    expect(PIECE_TYPES).toContain(g.next);
  });

  it('start() spawns a piece near the top-center', () => {
    const g = newGame();
    expect(g.status).toBe('playing');
    expect(g.current.row).toBe(0);
    expect(g.current.col).toBe(3);
    expect(g.score).toBe(0);
  });

  it('togglePause flips between playing and paused only', () => {
    const g = newGame();
    expect(togglePause(g)).toBe('paused');
    expect(moveLeft(g)).toBe(false);
    expect(togglePause(g)).toBe('playing');
    g.status = 'over';
    expect(togglePause(g)).toBe('over');
  });
});

describe('movement and collision', () => {
  it('moves left/right until the wall', () => {
    const g = newGame();
    let moves = 0;
    while (moveLeft(g)) moves++;
    expect(moves).toBeGreaterThan(0);
    expect(cellsOf(g.current).some(([, c]) => c === 0)).toBe(true);
    while (moveRight(g)) {}
    expect(cellsOf(g.current).some(([, c]) => c === COLS - 1)).toBe(true);
  });

  it('does not move into locked cells', () => {
    const g = newGame();
    g.current = makePiece('O'); // occupies cols 4-5, rows 0-1
    g.board[0][3] = 'I';
    g.board[1][3] = 'I';
    expect(moveLeft(g)).toBe(false);
    expect(g.current.col).toBe(3);
  });

  it('collides() detects walls, floor and blocks', () => {
    const board = createBoard();
    expect(collides(board, { type: 'O', rotation: 0, row: 0, col: -2 })).toBe(true);
    expect(collides(board, { type: 'O', rotation: 0, row: 0, col: COLS - 1 })).toBe(true);
    expect(collides(board, { type: 'O', rotation: 0, row: TOTAL_ROWS - 1, col: 3 })).toBe(true);
    expect(collides(board, { type: 'O', rotation: 0, row: TOTAL_ROWS - 2, col: 3 })).toBe(false);
    board[TOTAL_ROWS - 1][4] = 'T';
    expect(collides(board, { type: 'O', rotation: 0, row: TOTAL_ROWS - 2, col: 3 })).toBe(true);
  });
});

describe('rotation', () => {
  it('cycles through 4 rotation states clockwise and back', () => {
    const g = newGame();
    g.current = makePiece('T');
    g.current.row = 5;
    for (let i = 1; i <= 4; i++) {
      rotate(g, 1);
      expect(g.current.rotation).toBe(i % 4);
    }
    rotate(g, -1);
    expect(g.current.rotation).toBe(3);
  });

  it('wall-kicks an I piece off the left wall', () => {
    const g = newGame();
    g.current = { type: 'I', rotation: 1, row: 5, col: -2 }; // vertical, cells at col 0
    expect(collides(g.board, g.current)).toBe(false);
    expect(rotate(g, 1)).toBe(true);
    expect(g.current.rotation).toBe(2);
    expect(collides(g.board, g.current)).toBe(false);
  });

  it('refuses rotation when no kick fits', () => {
    const g = newGame();
    g.current = { type: 'I', rotation: 0, row: 10, col: 3 }; // horizontal at row 11
    // Wall in every cell of rows 9-13 except the horizontal I's own row.
    for (let r = 9; r <= 13; r++) if (r !== 11) fillRow(g.board, r);
    expect(rotate(g, 1)).toBe(false);
    expect(g.current.rotation).toBe(0);
  });
});

describe('dropping and locking', () => {
  it('tick moves the piece down one row', () => {
    const g = newGame();
    const before = g.current.row;
    expect(tick(g)).toBe(true);
    expect(g.current.row).toBe(before + 1);
  });

  it('hard drop lands on the floor, scores 2/cell and spawns the next piece', () => {
    const g = newGame();
    const type = g.current.type;
    const next = g.next;
    const dist = hardDrop(g);
    expect(dist).toBeGreaterThan(0);
    expect(g.score).toBe(dist * 2);
    expect(g.board[TOTAL_ROWS - 1].some((c) => c === type)).toBe(true);
    expect(g.current.type).toBe(next);
  });

  it('soft drop scores 1 per cell and locks when blocked', () => {
    const g = newGame();
    let steps = 0;
    while (softDrop(g)) steps++;
    expect(steps).toBeGreaterThan(0);
    expect(g.score).toBe(steps);
    expect(g.board.flat().filter(Boolean)).toHaveLength(4);
  });

  it('ghostRow matches where hard drop lands', () => {
    const g = newGame();
    const ghost = ghostRow(g);
    const type = g.current.type;
    const rot = g.current.rotation;
    const col = g.current.col;
    hardDrop(g);
    const expected = cellsOf({ type, rotation: rot, row: ghost, col });
    for (const [r, c] of expected) expect(g.board[r][c]).toBe(type);
  });
});

describe('line clearing and scoring', () => {
  it('clears a single full row and shifts rows above down', () => {
    const g = newGame();
    fillRow(g.board, TOTAL_ROWS - 1);
    g.board[TOTAL_ROWS - 2][0] = 'T';
    expect(clearLines(g)).toBe(1);
    expect(g.board[TOTAL_ROWS - 1][0]).toBe('T');
    expect(g.board[TOTAL_ROWS - 1].filter(Boolean)).toHaveLength(1);
    expect(g.board).toHaveLength(TOTAL_ROWS);
  });

  it.each([1, 2, 3, 4])('scores %i line(s) with NES table × (level+1)', (n) => {
    const g = newGame();
    g.level = 2;
    g.startLevel = 0;
    applyScore(g, n);
    expect(g.score).toBe(LINE_SCORES[n] * 3);
    expect(g.lines).toBe(n);
  });

  it('a vertical I completes 4 rows → Tetris', () => {
    const g = newGame();
    for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) fillRow(g.board, r, { skipCol: 0 });
    g.current = { type: 'I', rotation: 3, row: 0, col: -1 }; // vertical, cells at col 0
    drainEvents(g);
    hardDrop(g);
    expect(g.lines).toBe(4);
    expect(g.lastClear).toBe(4);
    expect(g.board.flat().filter(Boolean)).toHaveLength(0);
    expect(drainEvents(g)).toContain('tetris');
  });

  it('levels up every 10 lines and emits levelup', () => {
    const g = newGame();
    drainEvents(g);
    applyScore(g, 4);
    applyScore(g, 4);
    expect(g.level).toBe(0);
    applyScore(g, 2);
    expect(g.level).toBe(1);
    expect(drainEvents(g)).toContain('levelup');
  });
});

describe('hold', () => {
  it('stores the current piece and swaps on the second use', () => {
    const g = newGame();
    const first = g.current.type;
    const next = g.next;
    expect(hold(g)).toBe(true);
    expect(g.hold).toBe(first);
    expect(g.current.type).toBe(next);
    expect(hold(g)).toBe(false); // only once per piece
    hardDrop(g);
    const now = g.current.type;
    expect(hold(g)).toBe(true);
    expect(g.current.type).toBe(first);
    expect(g.hold).toBe(now);
  });
});

describe('game over', () => {
  it('ends when a new piece cannot spawn', () => {
    const g = newGame();
    for (let r = 0; r < TOTAL_ROWS; r++) fillRow(g.board, r);
    drainEvents(g);
    expect(spawn(g)).toBe(false);
    expect(g.status).toBe('over');
    expect(drainEvents(g)).toContain('gameover');
    expect(hardDrop(g)).toBe(0);
  });

  it('ends when a piece locks entirely inside the hidden rows', () => {
    const g = newGame();
    for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) fillRow(g.board, r, { skipCol: 9 });
    g.current = makePiece('O'); // rows 0-1 → hidden area
    lock(g);
    expect(g.status).toBe('over');
  });
});
