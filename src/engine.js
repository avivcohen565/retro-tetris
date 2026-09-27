// Pure game logic: no DOM, no timers. Everything operates on a plain state
// object so it can be unit-tested and rendered independently.

import {
  COLS, TOTAL_ROWS, HIDDEN_ROWS, PIECES, PIECE_TYPES, KICKS,
  LINE_SCORES, SOFT_DROP_POINTS, HARD_DROP_POINTS, LINES_PER_LEVEL,
} from './constants.js';

export function createBoard() {
  return Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(null));
}

// 7-bag randomizer: every 7 pieces contain each tetromino exactly once.
export function createBag(rng = Math.random) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function nextType(state) {
  if (state.bag.length === 0) state.bag = createBag(state.rng);
  return state.bag.shift();
}

export function makePiece(type) {
  return { type, rotation: 0, row: 0, col: Math.floor((COLS - 4) / 2) };
}

export function cellsOf(piece) {
  const shape = PIECES[piece.type].rotations[piece.rotation];
  return shape.map(([r, c]) => [piece.row + r, piece.col + c]);
}

export function collides(board, piece) {
  for (const [r, c] of cellsOf(piece)) {
    if (c < 0 || c >= COLS || r >= TOTAL_ROWS) return true;
    if (r >= 0 && board[r][c] !== null) return true;
  }
  return false;
}

export function createGame({ rng = Math.random, startLevel = 0 } = {}) {
  const state = {
    board: createBoard(),
    bag: [],
    rng,
    current: null,
    next: null,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: startLevel,
    startLevel,
    status: 'ready', // ready | playing | paused | over
    lastClear: 0,
    events: [],
  };
  state.next = nextType(state);
  return state;
}

export function start(state) {
  const fresh = createGame({ rng: state.rng, startLevel: state.startLevel });
  fresh.status = 'playing';
  spawn(fresh);
  return fresh;
}

export function spawn(state) {
  const type = state.next;
  state.next = nextType(state);
  const piece = makePiece(type);
  state.current = piece;
  state.canHold = true;
  if (collides(state.board, piece)) {
    state.status = 'over';
    state.events.push('gameover');
    return false;
  }
  return true;
}

function tryMove(state, dRow, dCol) {
  if (!state.current) return false;
  const moved = { ...state.current, row: state.current.row + dRow, col: state.current.col + dCol };
  if (collides(state.board, moved)) return false;
  state.current = moved;
  return true;
}

export function moveLeft(state) {
  if (state.status !== 'playing') return false;
  const ok = tryMove(state, 0, -1);
  if (ok) state.events.push('move');
  return ok;
}

export function moveRight(state) {
  if (state.status !== 'playing') return false;
  const ok = tryMove(state, 0, 1);
  if (ok) state.events.push('move');
  return ok;
}

export function rotate(state, dir = 1) {
  if (state.status !== 'playing' || !state.current) return false;
  const cur = state.current;
  const rotation = (cur.rotation + dir + 4) % 4;
  for (const [dr, dc] of KICKS) {
    const candidate = { ...cur, rotation, row: cur.row + dr, col: cur.col + dc };
    if (!collides(state.board, candidate)) {
      state.current = candidate;
      state.events.push('rotate');
      return true;
    }
  }
  return false;
}

// Soft drop: move down one cell (player-initiated, scores a point). Returns
// true if it moved, false if it locked instead.
export function softDrop(state) {
  if (state.status !== 'playing') return false;
  if (tryMove(state, 1, 0)) {
    state.score += SOFT_DROP_POINTS;
    return true;
  }
  lock(state);
  return false;
}

// Gravity tick: move down one cell, lock if blocked.
export function tick(state) {
  if (state.status !== 'playing') return false;
  if (tryMove(state, 1, 0)) return true;
  lock(state);
  return false;
}

export function hardDrop(state) {
  if (state.status !== 'playing') return 0;
  let dist = 0;
  while (tryMove(state, 1, 0)) dist++;
  state.score += dist * HARD_DROP_POINTS;
  state.events.push('harddrop');
  lock(state);
  return dist;
}

export function ghostRow(state) {
  if (!state.current) return null;
  let ghost = { ...state.current };
  while (!collides(state.board, { ...ghost, row: ghost.row + 1 })) ghost.row++;
  return ghost.row;
}

export function hold(state) {
  if (state.status !== 'playing' || !state.current || !state.canHold) return false;
  const held = state.hold;
  state.hold = state.current.type;
  if (held) {
    state.current = makePiece(held);
  } else {
    spawn(state);
  }
  state.canHold = false;
  state.events.push('hold');
  return true;
}

export function lock(state) {
  const piece = state.current;
  if (!piece) return;
  for (const [r, c] of cellsOf(piece)) {
    if (r < 0) continue;
    state.board[r][c] = piece.type;
  }
  state.events.push('lock');
  const cleared = clearLines(state);
  applyScore(state, cleared);
  // Lock-out: any locked cell entirely inside the hidden rows ends the game.
  if (cellsOf(piece).every(([r]) => r < HIDDEN_ROWS)) {
    state.current = null;
    state.status = 'over';
    state.events.push('gameover');
    return;
  }
  spawn(state);
}

export function clearLines(state) {
  const remaining = state.board.filter((row) => row.some((cell) => cell === null));
  const cleared = state.board.length - remaining.length;
  while (remaining.length < state.board.length) remaining.unshift(Array(COLS).fill(null));
  state.board = remaining;
  state.lastClear = cleared;
  if (cleared > 0) state.events.push(cleared === 4 ? 'tetris' : 'clear');
  return cleared;
}

export function applyScore(state, cleared) {
  if (cleared <= 0) return;
  state.score += LINE_SCORES[cleared] * (state.level + 1);
  state.lines += cleared;
  const newLevel = state.startLevel + Math.floor(state.lines / LINES_PER_LEVEL);
  if (newLevel > state.level) {
    state.level = newLevel;
    state.events.push('levelup');
  }
}

export function togglePause(state) {
  if (state.status === 'playing') state.status = 'paused';
  else if (state.status === 'paused') state.status = 'playing';
  return state.status;
}

export function drainEvents(state) {
  const ev = state.events;
  state.events = [];
  return ev;
}
