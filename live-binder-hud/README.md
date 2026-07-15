# Live TCG Binder HUD (Dynamic Multi-Card)

Architecture:

1. **Scan Feed** — raw `<video>` → hidden canvas → JPEG `@ 0.85` (no local CV).
2. **Gemini zero-shot detect** — full frame → JSON with `box_2d` `[ymin,xmin,ymax,xmax]` on a 0–1000 scale + name/set/number.
3. **HTML HUD** — map boxes onto absolutely positioned overlays; PriceCharting fills prices live.

No OpenCV, no contour/edge tracking, no fixed 3×3. Gemini does 100% of detection.

## Quick start

```bash
cd live-binder-hud
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:8787

## API

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/scan` | `{ image: dataUrl }` → `{ cards: [{ box_2d, name, set, number }] }` |
| `POST` | `/api/prices` | `{ cards: [{ slot, name, set, number }], apiKey? }` |

## CollecTools

- UI: `public/live-binder-hud/`
- Proxies: `/api/live-binder-hud/scan`, `/api/live-binder-hud/price`
- Supreme gate: `/live-binder-hud`
