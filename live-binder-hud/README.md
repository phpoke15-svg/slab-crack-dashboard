# Live TCG Binder HUD (v2)

Split architecture:

1. **Local CV (browser)** — Canvas / OpenCV.js detects however many card rectangles are in frame (**1–9**). No continuous video to Gemini.
2. **On-demand Gemini 3.5 Flash** — “Scan Cards” (or 2s stability auto-scan) crops only the detected cards and sends **one** API payload.
3. **PriceCharting** — Frontend prices each identified card via this Express proxy (or a UI-pasted API key), with `localStorage` cache.

## Quick start

```bash
cd live-binder-hud
cp .env.example .env
# set GEMINI_API_KEY and PRICECHARTING_API_KEY
npm install
npm run dev
```

Open http://localhost:8787

## API

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/scan` | `{ pockets: [{ slot, image: dataUrl }] }` → `{ cards: [{ slot, name, set, number }] }` |
| `POST` | `/api/prices` | `{ cards: [{ slot, name, set, number }], apiKey? }` |
| `GET` | `/api/price` | `?name=&set=&number=&slot=&apiKey=` |
| `GET` | `/api/health` | status |

## CollecTools integration

- Static UI: `public/live-binder-hud/`
- Supreme gate: `/live-binder-hud` (Next.js page → iframe)
- Production proxies: `/api/live-binder-hud/scan` and `/api/live-binder-hud/price`
