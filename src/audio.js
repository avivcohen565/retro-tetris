// Tiny 8-bit style sound effects synthesised with WebAudio (no audio files).

export function createAudio() {
  let ctx = null;
  let muted = false;

  try {
    muted = localStorage.getItem('retro-tetris-muted') === '1';
  } catch { /* storage unavailable */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function resume() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  // Play a sequence of [frequency, durationMs] notes on a square wave.
  function play(notes, { type = 'square', gain = 0.08 } = {}) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    let t = c.currentTime;
    for (const [freq, dur] of notes) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur / 1000);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur / 1000);
      t += dur / 1000;
    }
  }

  const sfx = {
    move: () => play([[220, 30]], { gain: 0.04 }),
    rotate: () => play([[440, 40], [660, 40]]),
    lock: () => play([[110, 60]], { type: 'triangle', gain: 0.1 }),
    harddrop: () => play([[80, 80]], { type: 'triangle', gain: 0.12 }),
    hold: () => play([[330, 40], [330, 40]]),
    clear: () => play([[523, 60], [659, 60], [784, 90]]),
    tetris: () => play([[523, 60], [659, 60], [784, 60], [1047, 60], [784, 60], [1047, 160]]),
    levelup: () => play([[392, 70], [523, 70], [659, 70], [784, 140]]),
    gameover: () => play([[392, 150], [330, 150], [262, 150], [196, 300]], { type: 'sawtooth', gain: 0.06 }),
    start: () => play([[262, 60], [330, 60], [392, 60], [523, 120]]),
    pause: () => play([[440, 60], [220, 60]]),
  };

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('retro-tetris-muted', muted ? '1' : '0'); } catch { /* ignore */ }
    return muted;
  }

  return { sfx, resume, toggleMute, isMuted: () => muted };
}
