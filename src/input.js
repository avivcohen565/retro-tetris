// Keyboard + touch input with DAS (delayed auto shift) for held left/right.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'rotate', KeyX: 'rotate', KeyW: 'rotate',
  KeyZ: 'rotateCCW',
  Space: 'drop',
  KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'start', KeyR: 'start',
  KeyM: 'mute',
};

export const DAS_DELAY = 170;
export const DAS_RATE = 50;
export const SOFT_RATE = 50;

export function createInput(handler, { root = document } = {}) {
  const held = new Map(); // action -> { since, lastRepeat }

  function press(action) {
    if (held.has(action)) return;
    held.set(action, { since: performance.now(), lastRepeat: 0 });
    handler(action);
  }

  function release(action) {
    held.delete(action);
  }

  function onKeyDown(e) {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    press(action);
  }

  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (!action) return;
    release(action);
  }

  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => held.clear());

  // Touch / mouse buttons
  for (const btn of root.querySelectorAll('[data-action]')) {
    const action = btn.dataset.action;
    const down = (e) => { e.preventDefault(); btn.classList.add('is-pressed'); press(action); };
    const up = (e) => { e.preventDefault(); btn.classList.remove('is-pressed'); release(action); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Called every frame: fires auto-repeat for held movement keys.
  function update(now) {
    for (const [action, h] of held) {
      if (action === 'left' || action === 'right') {
        if (now - h.since >= DAS_DELAY && now - h.lastRepeat >= DAS_RATE) {
          h.lastRepeat = now;
          handler(action);
        }
      } else if (action === 'down') {
        if (now - h.lastRepeat >= SOFT_RATE) {
          h.lastRepeat = now;
          handler(action);
        }
      }
    }
  }

  return { update, held };
}
