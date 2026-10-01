# 🕹️ Retro Tetris

A nostalgic, pixel-art Tetris built with vanilla HTML/CSS/JS and Canvas — no frameworks, no build step.

**Play:** https://avivcohen565.github.io/retro-tetris/

## Three layouts, one game

The page detects the device and picks a layout. The **LAYOUT** button in the start/pause menu cycles through
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
| P / Esc | Pause / resume |
| Enter | Start / restart |
| M | Toggle sound |

**Touch** (phone & tablet) — classic two-thumb layout:

| Control | Action |
| --- | --- |
| D-pad ← / → | Move (hold to auto-repeat) |
| D-pad ↓ | Soft drop |
| D-pad ↑ (DROP) | Hard drop — fresh press only, so sliding your thumb never drops by accident |
| A | Rotate clockwise |
| B | Rotate counter-clockwise |
| HOLD / PAUSE pills | Hold piece / pause menu |
| 🔊 in the header | Sound on/off |

The D-pad is one touch zone: slide your thumb between ← → ↓ without lifting it.
Gestures also work on the board: tap = rotate, drag = move, drag down = soft drop,
quick flick down = hard drop, two-finger tap = hold.

## Comfort features

- **Menus with big buttons** on the start, pause and game-over screens: resume, restart, sound, layout.
- **3-2-1 countdown** when resuming, so your thumbs are back on the controls before pieces fall.
- **Auto-pause** when you leave the app (call, notification, tab switch).
- **Colour ghost piece** and faint column guides to aim drops.
- **Readable HUD**: larger pixel text, higher contrast, lighter scanlines.
- **iPhone in Safari**: when the toolbars make the screen short, the HUD moves beside the board so the board stays big.

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
