// Touch gestures on the board: tap = rotate, drag left/right = move one cell
// per step, drag down = soft drop, quick flick down = hard drop, two-finger
// tap = hold. Pure state machine fed with (x, y, time) so it is testable.

export function createGestures({
  cell = 24,
  onAction,
  tapMaxMs = 250,
  tapMaxDist = 10,
  flickMs = 250,
  dragCell = 0.8,
} = {}) {
  let active = false;
  let sx = 0, sy = 0, st = 0; // start
  let ax = 0, ay = 0;         // anchor for stepping
  let axis = null;
  let fingers = 1;
  let moved = false;

  const step = () => cell * dragCell;

  return {
    setCell(c) { cell = c; },

    start(x, y, t, touches = 1) {
      active = true;
      sx = ax = x;
      sy = ay = y;
      st = t;
      axis = null;
      fingers = touches;
      moved = false;
    },

    touches(n) {
      if (active) fingers = Math.max(fingers, n);
    },

    move(x, y, t) {
      if (!active) return;
      if (Math.hypot(x - sx, y - sy) > tapMaxDist) moved = true;
      if (fingers > 1) return;
      const s = step();
      if (!axis) {
        const dx = Math.abs(x - ax);
        const dy = Math.abs(y - ay);
        if (dx < s && dy < s) return;
        axis = dx >= dy ? 'x' : 'y';
      }
      if (axis === 'x') {
        while (Math.abs(x - ax) >= s) {
          const dir = x > ax ? 1 : -1;
          onAction(dir > 0 ? 'right' : 'left');
          ax += dir * s;
        }
        ay = y;
      } else {
        while (y - ay >= s) {
          onAction('down');
          ay += s;
        }
        if (y < ay) ay = y;
        ax = x;
      }
    },

    end(x, y, t) {
      if (!active) return;
      active = false;
      const dt = t - st;
      if (fingers >= 2) {
        if (!moved) onAction('hold');
        return;
      }
      if (!moved && dt <= tapMaxMs) {
        onAction('rotate');
        return;
      }
      if (axis === 'y' && dt <= flickMs && y - sy >= cell * 1.5) onAction('drop');
    },

    cancel() { active = false; },
  };
}

// Wires DOM touch events on `el` into a gesture recognizer.
export function attachTouch(el, gestures) {
  const opts = { passive: false };
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      gestures.start(t.clientX, t.clientY, e.timeStamp, 1);
    } else {
      gestures.touches(e.touches.length);
    }
  }, opts);
  el.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    gestures.move(t.clientX, t.clientY, e.timeStamp);
  }, opts);
  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) return;
    const t = e.changedTouches[0];
    gestures.end(t.clientX, t.clientY, e.timeStamp);
  }, opts);
  el.addEventListener('touchcancel', () => gestures.cancel(), opts);
}
