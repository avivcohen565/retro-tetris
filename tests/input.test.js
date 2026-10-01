import { describe, it, expect } from 'vitest';
import { dpadDirection, nextDpadDirection, DPAD_ACTIONS, DPAD_DEAD_ZONE } from '../src/input.js';

describe('dpadDirection', () => {
  const R = 60;

  it('ignores touches inside the dead zone', () => {
    expect(dpadDirection(0, 0, R)).toBeNull();
    expect(dpadDirection(R * DPAD_DEAD_ZONE - 1, 0, R)).toBeNull();
  });

  it('maps each arm to its direction', () => {
    expect(dpadDirection(-40, 0, R)).toBe('left');
    expect(dpadDirection(40, 0, R)).toBe('right');
    expect(dpadDirection(0, -40, R)).toBe('up');
    expect(dpadDirection(0, 40, R)).toBe('down');
  });

  it('lets the dominant axis win on diagonals', () => {
    expect(dpadDirection(-40, 30, R)).toBe('left');
    expect(dpadDirection(20, 45, R)).toBe('down');
    expect(dpadDirection(30, -30, R)).toBe('right'); // exact diagonal -> horizontal
  });

  it('keeps working when the thumb drifts outside the pad', () => {
    expect(dpadDirection(-200, 10, R)).toBe('left');
    expect(dpadDirection(5, 150, R)).toBe('down');
  });
});

describe('nextDpadDirection', () => {
  it('fires hard drop only on a fresh press of the up arm', () => {
    expect(nextDpadDirection(null, 'up', false)).toBe('up');
    expect(nextDpadDirection('left', 'up', true)).toBeNull();
    expect(nextDpadDirection(null, 'up', true)).toBeNull();
    expect(nextDpadDirection('up', 'up', true)).toBe('up');
  });

  it('slides freely between left, right and down', () => {
    expect(nextDpadDirection('left', 'right', true)).toBe('right');
    expect(nextDpadDirection('right', 'down', true)).toBe('down');
    expect(nextDpadDirection('down', null, true)).toBeNull();
  });

  it('maps up to hard drop and down to soft drop', () => {
    expect(DPAD_ACTIONS.up).toBe('drop');
    expect(DPAD_ACTIONS.down).toBe('down');
    expect(DPAD_ACTIONS.left).toBe('left');
  });
});
