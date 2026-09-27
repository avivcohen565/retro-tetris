import { gravityForLevel, COLS } from './constants.js';
import {
  createGame, start, moveLeft, moveRight, rotate, softDrop, hardDrop, tick,
  hold, togglePause, drainEvents, cellsOf, collides,
} from './engine.js';
import { drawBoard, drawPreview } from './renderer.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const boardCtx = $('board').getContext('2d');
const nextCtx = $('next').getContext('2d');
const holdCtx = $('hold').getContext('2d');
const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlayText = $('overlay-text');
const scoreEl = $('score');
const levelEl = $('level');
const linesEl = $('lines');
const hiEl = $('hiscore');

const HI_KEY = 'retro-tetris-hiscore';
const FLASH_MS = 260;

let hiscore = 0;
try { hiscore = Number(localStorage.getItem(HI_KEY)) || 0; } catch { /* storage unavailable */ }
hiEl.textContent = String(hiscore);

const audio = createAudio();
let game = createGame();
let gravityAcc = 0;
let lastTime = 0;
let flash = null; // { rows, until, oldBoard, landed, type } — line-clear blink

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function updateHud() {
  scoreEl.textContent = String(game.score);
  levelEl.textContent = String(game.level);
  linesEl.textContent = String(game.lines);
  if (game.score > hiscore) {
    hiscore = game.score;
    hiEl.textContent = String(hiscore);
    try { localStorage.setItem(HI_KEY, String(hiscore)); } catch { /* ignore */ }
  }
  drawPreview(nextCtx, game.next);
  drawPreview(holdCtx, game.hold);
}

function beginGame() {
  audio.resume();
  game = start(game);
  gravityAcc = 0;
  flash = null;
  hideOverlay();
  drainEvents(game);
  audio.sfx.start();
  updateHud();
}

function handleEvents() {
  for (const ev of drainEvents(game)) {
    if (ev === 'gameover') showOverlay('GAME OVER', `SCORE ${game.score}  -  PRESS ENTER`);
    if (audio.sfx[ev]) audio.sfx[ev]();
  }
}

// Where the current piece will land on the given board.
function landingCells(board, piece) {
  const p = { ...piece };
  while (!collides(board, { ...p, row: p.row + 1 })) p.row++;
  return cellsOf(p);
}

// Runs a drop/tick action. If it locked the piece and cleared lines, sets up
// the blink animation showing the pre-clear board with the full rows flashing.
function lockAware(fn) {
  const board = game.board;
  const piece = game.current;
  if (!piece) { fn(); return; }
  const landed = landingCells(board, piece);
  fn();
  if (game.board === board || game.lastClear === 0) return;

  const rows = [];
  for (const [r] of landed) {
    if (rows.includes(r) || r < 0) continue;
    const filled = board[r].filter(Boolean).length + landed.filter(([rr]) => rr === r).length;
    if (filled >= COLS) rows.push(r);
  }
  flash = { rows, until: performance.now() + FLASH_MS, oldBoard: board, landed, type: piece.type };
}

function act(action) {
  if (action === 'mute') {
    const m = audio.toggleMute();
    overlayText.textContent = m ? 'SOUND OFF' : 'SOUND ON';
    return;
  }
  if (action === 'start') {
    if (game.status === 'ready' || game.status === 'over') beginGame();
    else if (game.status === 'paused') { togglePause(game); hideOverlay(); }
    return;
  }
  if (action === 'pause') {
    if (game.status === 'playing') {
      togglePause(game);
      showOverlay('PAUSED', 'PRESS P TO RESUME');
      audio.sfx.pause();
    } else if (game.status === 'paused') {
      togglePause(game);
      hideOverlay();
    }
    return;
  }
  if (game.status !== 'playing' || flash) return;

  switch (action) {
    case 'left': moveLeft(game); break;
    case 'right': moveRight(game); break;
    case 'rotate': rotate(game, 1); break;
    case 'rotateCCW': rotate(game, -1); break;
    case 'down': lockAware(() => softDrop(game)); break;
    case 'drop': lockAware(() => hardDrop(game)); break;
    case 'hold': hold(game); break;
    default: return;
  }
  handleEvents();
  updateHud();
}

const input = createInput(act);

function drawFlash(now) {
  const on = Math.floor((flash.until - now) / 65) % 2 === 0;
  const board = flash.oldBoard.map((r) => [...r]);
  for (const [r, c] of flash.landed) if (r >= 0) board[r][c] = flash.type;
  drawBoard(boardCtx, { ...game, board, current: null }, { flashRows: flash.rows, flashOn: on });
}

function frame(now) {
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;
  input.update(now);

  if (flash) {
    if (now < flash.until) {
      drawFlash(now);
      requestAnimationFrame(frame);
      return;
    }
    flash = null;
    gravityAcc = 0;
  }

  if (game.status === 'playing') {
    if (input.held.has('down')) {
      gravityAcc = 0; // soft drop handles descent
    } else {
      gravityAcc += dt;
      const g = gravityForLevel(game.level);
      while (gravityAcc >= g && game.status === 'playing' && !flash) {
        gravityAcc -= g;
        lockAware(() => tick(game));
        handleEvents();
      }
    }
    updateHud();
  }

  drawBoard(boardCtx, game);
  requestAnimationFrame(frame);
}

drawBoard(boardCtx, game);
updateHud();
showOverlay('RETRO TETRIS', 'PRESS ENTER OR START');
requestAnimationFrame((t) => { lastTime = t; frame(t); });

// Debug hook (only with ?debug in the URL): lets tests poke at the live state.
if (new URLSearchParams(location.search).has('debug')) {
  window.__tetris = {
    get game() { return game; },
    set game(g) { game = g; },
    act,
  };
}
