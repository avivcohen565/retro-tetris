import { describe, it, expect } from 'vitest';
import { createGestures } from '../src/touch.js';

function rig(opts = {}) {
  const actions = [];
  const g = createGestures({ cell: 20, onAction: (a) => actions.push(a), ...opts });
  return { g, actions };
}

describe('touch gestures', () => {
  it('a quick tap rotates', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.move(103, 101, 50);
    g.end(103, 101, 120);
    expect(actions).toEqual(['rotate']);
  });

  it('a long press does nothing', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.end(100, 100, 600);
    expect(actions).toEqual([]);
  });

  it('dragging right moves one cell per step', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.move(120, 100, 30);  // 20px = 1.25 steps of 16px
    g.move(150, 102, 60);  // +30px → total 50px = 3.1 steps
    g.end(150, 102, 400);
    expect(actions).toEqual(['right', 'right', 'right']);
  });

  it('dragging left moves left and reversing direction moves back', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.move(60, 100, 30);
    g.move(100, 100, 60);
    g.end(100, 100, 500);
    expect(actions).toEqual(['left', 'left', 'right', 'right']);
  });

  it('locks to the first axis: horizontal drags ignore vertical drift', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.move(130, 100, 30);
    g.move(130, 200, 60);
    g.end(130, 200, 500);
    expect(actions.every((a) => a === 'right')).toBe(true);
  });

  it('a slow drag down soft-drops per step without a hard drop', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.move(100, 140, 200);
    g.move(100, 180, 400);
    g.end(100, 180, 600);
    expect(actions.filter((a) => a === 'down')).toHaveLength(5);
    expect(actions).not.toContain('drop');
  });

  it('a fast flick down hard-drops', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.move(100, 160, 40);
    g.end(100, 170, 90);
    expect(actions[actions.length - 1]).toBe('drop');
  });

  it('a two-finger tap holds; a two-finger drag does nothing', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0, 2);
    g.end(100, 100, 100);
    expect(actions).toEqual(['hold']);

    const second = rig();
    second.g.start(100, 100, 0, 1);
    second.g.touches(2);
    second.g.move(160, 100, 50);
    second.g.end(160, 100, 100);
    expect(second.actions).toEqual([]);
  });

  it('cancel discards the gesture', () => {
    const { g, actions } = rig();
    g.start(100, 100, 0);
    g.cancel();
    g.end(100, 100, 50);
    expect(actions).toEqual([]);
  });

  it('setCell changes the drag step', () => {
    const { g, actions } = rig();
    g.setCell(50);
    g.start(0, 0, 0);
    g.move(45, 0, 30); // 45px > 40px step → one move
    g.end(45, 0, 400);
    expect(actions).toEqual(['right']);
  });
});
