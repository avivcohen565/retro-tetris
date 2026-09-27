# 🕹️ Retro Tetris

A nostalgic, pixel-art Tetris built with vanilla HTML/CSS/JS and Canvas — no frameworks, no build step.

**Play:** https://avivcohen565.github.io/retro-tetris/

## Controls

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

Touch controls appear on mobile.

## Development

```bash
npm install
npm test        # unit tests (Vitest)
npm start       # static server on http://localhost:5173
```

## Scoring (NES style)

1 line = 40, 2 = 100, 3 = 300, 4 (Tetris) = 1200 — each multiplied by (level + 1).
Level increases every 10 lines; gravity speeds up accordingly.
