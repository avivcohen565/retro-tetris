# 🕹️ Retro Tetris

A nostalgic, pixel-art Tetris built with vanilla HTML/CSS/JS and Canvas — no frameworks, no build step.

**Play:** https://avivcohen565.github.io/retro-tetris/

## Three layouts, one game

The page detects the device and picks a layout. The `AUTO·…` button in the header cycles through
`AUTO → PHONE → TABLET → DESKTOP` (saved), and `?layout=phone|tablet|desktop` forces one for a single load.

| Layout | When | What you get |
| --- | --- | --- |
| **Phone** (iPhone) | touch device, shorter side < 600px | Full-width board sized to the screen, compact HOLD / stats / NEXT strip on top, Game Boy D-pad + A/B at the bottom, swipe gestures on the board, safe-area aware, no page bounce. Landscape puts the D-pad and A/B on the sides. |
| **Tablet** (iPad 13") | touch device, larger screens | Big board (≈ 2× the phone's blocks), large thumb-sized buttons. Portrait: controls along the bottom corners. Landscape: D-pad on the left, A/B on the right, so both thumbs rest on the edges while holding the iPad. |
| **Desktop** (Mac/PC) | mouse/trackpad | Board scaled to the window height, keyboard legend on screen, no touch buttons. |

Every layout renders the board at the device's native pixel density, so blocks stay crisp on Retina screens.

Tip: on iPhone/iPad use **Share → Add to Home Screen** to play full-screen with the pixel icon.

## Controls

**Keyboard**

| Key | Action |
| --- | --- |
| ← / → | Move |
| ↑ / X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| C | Hold |
| P / Esc | Pause |
| Enter | Start / Restart |
| M | Toggle sound |

**Touch** (phone & tablet): the on-screen D-pad, **A** = hard drop, **B** = hold, plus gestures on the board:
tap = rotate, drag left/right = move, drag down = soft drop, quick flick down = hard drop, two-finger tap = hold.
Tap the overlay to start, resume or restart.

## Development

```bash
npm install
npm test        # unit tests (Vitest): engine, layout, gestures
npm start       # static server on http://localhost:5173
node scripts/make-icons.mjs   # regenerate the PNG icons
```

`?debug` in the URL exposes `window.__tetris` (live game state, layout, `act()`) for manual testing.

## Scoring (NES style)

1 line = 40, 2 = 100, 3 = 300, 4 (Tetris) = 1200 — each multiplied by (level + 1).
Level increases every 10 lines; gravity speeds up accordingly.
