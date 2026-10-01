// Keyboard + touch input with DAS (delayed auto shift) for held moves.
// Touch uses [data-action] buttons plus a slide-able D-pad ([data-dpad]).

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
export const DPAD_DEAD_ZONE = 0.2; // fraction of the pad's radius

// D-pad arm -> game action. Up is hard drop, as on guideline controllers.
export const DPAD_ACTIONS = { left: 'left', right: 'right', down: 'down', up: 'drop' };

// Direction for a touch at (dx, dy) from the D-pad centre, or null inside the
// dead zone. The dominant axis wins, so a diagonal never fires two actions.
export function dpadDirection(dx, dy, radius) {
  if (Math.hypot(dx, dy) < radius * DPAD_DEAD_ZONE) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

// Hard drop is a commitment: it fires only on a fresh press of the up arm,
// never when a thumb slides into it from another direction.
export function nextDpadDirection(current, target, sliding) {
  if (target === 'up' && sliding && current !== 'up') return null;
  return target;
}

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

  root.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    press(action);
  });

  root.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) release(action);
  });

  window.addEventListener('blur', () => held.clear());

  function bindButton(btn) {
    const action = btn.dataset.action;
    const down = (e) => { e.preventDefault(); btn.classList.add('is-pressed'); press(action); };
    const up = () => { btn.classList.remove('is-pressed'); release(action); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function bindDpad(pad) {
    const arms = {};
    for (const el of pad.querySelectorAll('[data-dir]')) arms[el.dataset.dir] = el;
    let pointerId = null;
    let dir = null;

    function setDir(target, sliding) {
      const next = nextDpadDirection(dir, target, sliding);
      if (next === dir) return;
      if (dir) { arms[dir]?.classList.remove('is-pressed'); release(DPAD_ACTIONS[dir]); }
      dir = next;
      if (dir) { arms[dir]?.classList.add('is-pressed'); press(DPAD_ACTIONS[dir]); }
    }

    function locate(e) {
      const r = pad.getBoundingClientRect();
      return dpadDirection(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2);
    }

    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      try { pad.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      setDir(locate(e), false);
    });

    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      setDir(locate(e), true);
    });

    const end = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      setDir(null, false);
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  for (const btn of root.querySelectorAll('[data-action]')) bindButton(btn);
  const pad = root.querySelector('[data-dpad]');
  if (pad) bindDpad(pad);

  // Called every frame: auto-repeat for held movement and soft drop.
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
