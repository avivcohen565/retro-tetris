import { gravityForLevel, COLS } from './constants.js';
import {
  createGame, start, moveLeft, moveRight, rotate, softDrop, hardDrop, tick,
  hold, togglePause, drainEvents, cellsOf, collides,
} from './engine.js';
import { drawBoard, drawPreview } from './renderer.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { MODES, detectMode, computeLayout, applyLayout, previewBlock } from './layout.js';
import { createGestures, attachTouch } from './touch.js';

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const nextEl = $('next');
const holdEl = $('hold');
const boardCtx = boardEl.getContext('2d');
const nextCtx = nextEl.getContext('2d');
const holdCtx = holdEl.getContext('2d');
const consoleEl = $('console');
const screenEl = $('screen');
const hudEl = document.querySelector('.hud');
const dpadEl = document.querySelector('.dpad');
const midEl = document.querySelector('.mid-buttons');
const abEl = document.querySelector('.ab-buttons');
const modeBtn = $('mode-btn');
const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlayText = $('overlay-text');
const scoreEl = $('score');
const levelEl = $('level');
const linesEl = $('lines');
const hiEl = $('hiscore');

const HI_KEY = 'retro-tetris-hiscore';
const LAYOUT_KEY = 'retro-tetris-layout';
const FLASH_MS = 260;

let hiscore = 0;
try { hiscore = Number(localStorage.getItem(HI_KEY)) || 0; } catch { /* storage unavailable */ }
hiEl.textContent = String(hiscore);

const audio = createAudio();
let game = createGame();
let gravityAcc = 0;
let lastTime = 0;
let flash = null; // { rows, until, oldBoard, landed, type } — line-clear blink
let layout = null;
let layoutOverride = readLayoutOverride();

// ---------- Layout (phone / tablet / desktop) ----------

function readLayoutOverride() {
  const param = new URLSearchParams(location.search).get('layout');
  if (param && MODES.includes(param)) return param;
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (saved && MODES.includes(saved)) return saved;
  } catch { /* ignore */ }
  return null;
}

function isTouchDevice() {
  return navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
}

function hasFinePointer() {
  return matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function viewportSize() {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

// True when the layout does not fit. Uses offset boxes (unaffected by the
// rotated buttons' transforms, which would inflate scrollWidth/scrollHeight).
function overflows() {
  const fits = (el, parent) => el.offsetTop + el.offsetHeight <= parent.clientHeight + 1
    && el.offsetLeft + el.offsetWidth <= parent.clientWidth + 1;
  if (!fits(hudEl, screenEl)) return true;
  for (const el of [screenEl, dpadEl, midEl, abEl]) {
    if (el.offsetParent === consoleEl && !fits(el, consoleEl)) return true;
  }
  const r = consoleEl.getBoundingClientRect();
  return r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1;
}

const isTouchLayout = () => layout && layout.mode !== 'desktop';

function relayout() {
  const { width, height } = viewportSize();
  const mode = detectMode({
    width, height, touch: isTouchDevice(), finePointer: hasFinePointer(), override: layoutOverride,
  });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const targets = { root: document.documentElement, board: boardEl, next: nextEl, hold: holdEl };
  layout = computeLayout(mode, width, height, dpr);
  applyLayout(layout, targets);
  // The spec is an estimate; shrink until the real DOM fits the viewport.
  for (let i = 0; i < 12 && layout.cell > 8 && overflows(); i++) {
    layout = computeLayout(mode, width, height, dpr, { maxCell: layout.cell - 1 });
    applyLayout(layout, targets);
  }
  gestures.setCell(layout.cell);
  modeBtn.textContent = layoutOverride ? layoutOverride.toUpperCase() : `AUTO·${mode.toUpperCase()}`;
  if (game.status === 'ready') showStartOverlay();
  else if (game.status === 'paused') showPauseOverlay();
  else if (game.status === 'over') showGameOverOverlay();
  updateHud();
  drawFrame(performance.now());
}

let relayoutQueued = false;
function queueRelayout() {
  if (relayoutQueued) return;
  relayoutQueued = true;
  requestAnimationFrame(() => { relayoutQueued = false; relayout(); });
}

function cycleLayoutOverride() {
  const cycle = [null, ...MODES];
  layoutOverride = cycle[(cycle.indexOf(layoutOverride) + 1) % cycle.length];
  try {
    if (layoutOverride) localStorage.setItem(LAYOUT_KEY, layoutOverride);
    else localStorage.removeItem(LAYOUT_KEY);
  } catch { /* ignore */ }
  relayout();
}

// ---------- HUD / overlay ----------

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

const showStartOverlay = () => showOverlay('RETRO TETRIS', isTouchLayout() ? 'TAP TO START' : 'PRESS ENTER');
const showPauseOverlay = () => showOverlay('PAUSED', isTouchLayout() ? 'TAP TO RESUME' : 'PRESS P TO RESUME');
const showGameOverOverlay = () => showOverlay('GAME OVER', `SCORE ${game.score}  -  ${isTouchLayout() ? 'TAP TO RESTART' : 'PRESS ENTER'}`);

function updateHud() {
  scoreEl.textContent = String(game.score);
  levelEl.textContent = String(game.level);
  linesEl.textContent = String(game.lines);
  if (game.score > hiscore) {
    hiscore = game.score;
    try { localStorage.setItem(HI_KEY, String(hiscore)); } catch { /* ignore */ }
  }
  hiEl.textContent = String(hiscore);
  const block = previewBlock(layout);
  drawPreview(nextCtx, game.next, { canvasSize: nextEl.width, block });
  drawPreview(holdCtx, game.hold, { canvasSize: holdEl.width, block });
}

// ---------- Game flow ----------

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
    if (ev === 'gameover') showGameOverOverlay();
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
      showPauseOverlay();
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
const gestures = createGestures({ onAction: act });
attachTouch(boardEl, gestures);
overlay.addEventListener('click', () => act('start'));
modeBtn.addEventListener('click', () => { cycleLayoutOverride(); modeBtn.blur(); });
window.addEventListener('resize', queueRelayout);
window.addEventListener('orientationchange', queueRelayout);
window.visualViewport?.addEventListener('resize', queueRelayout);

// ---------- Render loop ----------

function drawFlash(now) {
  const on = Math.floor((flash.until - now) / 65) % 2 === 0;
  const board = flash.oldBoard.map((r) => [...r]);
  for (const [r, c] of flash.landed) if (r >= 0) board[r][c] = flash.type;
  drawBoard(boardCtx, { ...game, board, current: null }, { cell: layout.cellPx, flashRows: flash.rows, flashOn: on });
}

function drawFrame(now) {
  if (flash && now < flash.until) drawFlash(now);
  else drawBoard(boardCtx, game, { cell: layout.cellPx });
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

  drawBoard(boardCtx, game, { cell: layout.cellPx });
  requestAnimationFrame(frame);
}

relayout();
requestAnimationFrame((t) => { lastTime = t; frame(t); });

// Debug hook (only with ?debug in the URL): lets tests poke at the live state.
if (new URLSearchParams(location.search).has('debug')) {
  window.__tetris = {
    get game() { return game; },
    set game(g) { game = g; },
    get layout() { return layout; },
    act,
    relayout,
  };
}
