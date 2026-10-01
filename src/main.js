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
const soundBtn = $('sound-btn');
const pauseBtn = $('pause-btn');
const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlayText = $('overlay-text');
const overlayHint = $('overlay-hint');
const menuEl = $('menu');
const menuPrimary = $('menu-primary');
const menuRestart = $('menu-restart');
const menuSound = $('menu-sound');
const menuLayout = $('menu-layout');
const scoreEl = $('score');
const levelEl = $('level');
const linesEl = $('lines');
const hiEl = $('hiscore');

const HI_KEY = 'retro-tetris-hiscore';
const LAYOUT_KEY = 'retro-tetris-layout';
const FLASH_MS = 260;
const COUNT_STEP_MS = 450; // resume countdown: 3, 2, 1
const RESTART_GUARD_MS = 700; // taps right after game over don't restart

let hiscore = 0;
try { hiscore = Number(localStorage.getItem(HI_KEY)) || 0; } catch { /* storage unavailable */ }

const audio = createAudio();
let game = createGame();
let bestAtStart = hiscore;
let gravityAcc = 0;
let lastTime = 0;
let flash = null;     // { rows, until, oldBoard, landed, type } — line-clear blink
let countdown = null; // { until, shown } — resume countdown
let restartGuardUntil = 0;
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

// True when the layout does not fit. Uses offset boxes, which ignore the
// buttons' transforms. Controls are only checked vertically: their width is
// set from the screen width, so shrinking the board would not help them.
function overflows() {
  const fitsV = (el, parent) => el.offsetTop + el.offsetHeight <= parent.clientHeight + 1;
  const fitsH = (el, parent) => el.offsetLeft + el.offsetWidth <= parent.clientWidth + 1;
  if (!fitsV(hudEl, screenEl) || !fitsH(hudEl, screenEl)) return true;
  for (const el of [screenEl, dpadEl, midEl, abEl]) {
    if (el.offsetParent === consoleEl && !fitsV(el, consoleEl)) return true;
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
  for (let i = 0; i < 16 && layout.cell > 8 && overflows(); i++) {
    layout = computeLayout(mode, width, height, dpr, { maxCell: layout.cell - 1 });
    applyLayout(layout, targets);
  }
  gestures.setCell(layout.cell);
  refreshScreen();
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

// ---------- Overlay menus ----------

function refreshControls() {
  const muted = audio.isMuted();
  soundBtn.classList.toggle('is-off', muted);
  soundBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  soundBtn.setAttribute('aria-pressed', String(!muted));
  const playing = game.status === 'playing' && !countdown;
  pauseBtn.classList.toggle('is-off', !playing);
  pauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Resume');
  menuSound.textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
  menuLayout.textContent = `LAYOUT: ${layoutOverride ? layoutOverride.toUpperCase() : 'AUTO'}`;
}

function showOverlay(title, text = '', hint = '') {
  overlay.classList.remove('overlay--count');
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayHint.textContent = hint;
  overlayHint.classList.remove('blink');
  overlay.hidden = false;
  refreshControls();
}

function hideOverlay() {
  overlay.hidden = true;
  refreshControls();
}

function setMenu(primary, { restart = false, extras = true } = {}) {
  menuEl.hidden = false;
  menuPrimary.textContent = primary;
  menuRestart.hidden = !restart;
  menuSound.hidden = !extras;
  menuLayout.hidden = !extras;
}

function showStartScreen() {
  const touch = isTouchLayout();
  showOverlay(
    'RETRO TETRIS',
    hiscore ? `HI-SCORE ${hiscore}` : '',
    touch ? 'TAP: ROTATE\nSWIPE: MOVE\nFLICK: DROP' : 'PRESS ENTER',
  );
  overlayHint.classList.toggle('blink', !touch);
  setMenu('START');
}

function showPauseMenu() {
  showOverlay('PAUSED');
  setMenu('RESUME', { restart: true });
}

function showGameOver() {
  const best = game.score > 0 && game.score > bestAtStart;
  showOverlay('GAME OVER', best ? `NEW HI-SCORE!\n${game.score}` : `SCORE ${game.score}`);
  setMenu('PLAY AGAIN', { extras: false });
  restartGuardUntil = performance.now() + RESTART_GUARD_MS;
}

function showCountdown(n) {
  showOverlay(String(n));
  overlay.classList.add('overlay--count');
  menuEl.hidden = true;
}

// Re-renders whatever screen is up (text differs between touch and keyboard).
function refreshScreen() {
  if (countdown) return;
  if (game.status === 'ready') showStartScreen();
  else if (game.status === 'paused') showPauseMenu();
  else if (game.status === 'over') showGameOver();
  else refreshControls();
}

// ---------- HUD ----------

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
  bestAtStart = hiscore;
  countdown = null;
  game = start(game);
  gravityAcc = 0;
  flash = null;
  drainEvents(game);
  hideOverlay();
  audio.sfx.start();
  updateHud();
}

function pauseGame() {
  if (game.status !== 'playing') return;
  togglePause(game);
  showPauseMenu();
  audio.sfx.pause();
}

// Resuming counts 3-2-1 first, so thumbs can get back on the controls.
function beginResume() {
  if (game.status !== 'paused' || countdown) return;
  audio.resume();
  countdown = { until: performance.now() + COUNT_STEP_MS * 3, shown: 3 };
  showCountdown(3);
  audio.sfx.count();
}

function finishResume() {
  countdown = null;
  togglePause(game);
  gravityAcc = 0;
  hideOverlay();
}

function cancelCountdown() {
  countdown = null;
  showPauseMenu();
}

function primaryAction() {
  if (performance.now() < restartGuardUntil) return;
  if (game.status === 'ready' || game.status === 'over') beginGame();
  else if (game.status === 'paused' && !countdown) beginResume();
}

function autoPause() {
  if (game.status === 'playing') pauseGame();
  else if (countdown) cancelCountdown();
}

function toggleSound() {
  audio.toggleMute();
  audio.resume();
  refreshControls();
}

function handleEvents() {
  for (const ev of drainEvents(game)) {
    if (ev === 'gameover') showGameOver();
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
  switch (action) {
    case 'mute': toggleSound(); return;
    case 'start': primaryAction(); return;
    case 'pause':
      if (game.status === 'playing') pauseGame();
      else if (countdown) cancelCountdown();
      else if (game.status === 'paused') beginResume();
      return;
    case 'playpause': // header button: pause while playing, otherwise start/resume
      if (game.status === 'playing') pauseGame();
      else if (countdown) cancelCountdown();
      else primaryAction();
      return;
    default: break;
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

// ---------- Wiring ----------

const input = createInput(act);
const gestures = createGestures({ onAction: act });
attachTouch(boardEl, gestures);

overlay.addEventListener('click', (e) => {
  if (countdown || e.target.closest('[data-menu]')) return;
  primaryAction();
});

menuEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-menu]');
  if (!btn) return;
  e.stopPropagation();
  btn.blur();
  const kind = btn.dataset.menu;
  if (kind === 'primary') primaryAction();
  else if (kind === 'restart') beginGame();
  else if (kind === 'sound') toggleSound();
  else if (kind === 'layout') cycleLayoutOverride();
});

// Leaving the app (call, notification, tab switch) pauses the game.
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('pagehide', autoPause);
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

  if (countdown) {
    const left = countdown.until - now;
    if (left <= 0) {
      finishResume();
    } else {
      const n = Math.ceil(left / COUNT_STEP_MS);
      if (n !== countdown.shown) {
        countdown.shown = n;
        overlayTitle.textContent = String(n);
        audio.sfx.count();
      }
    }
  }

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
    get countdown() { return countdown; },
    act,
    relayout,
    autoPause,
    skipCountdown() { if (countdown) countdown.until = 0; },
  };
}
