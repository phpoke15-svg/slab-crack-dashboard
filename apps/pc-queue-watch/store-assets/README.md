# CollecTools — App Store screenshots & previews

All assets sized for **iPhone 6.5" Display** (**1242 × 2688** portrait).

Folder:
`apps/pc-queue-watch/store-assets/`

## Upload order (10 screenshots)

In App Store Connect → your app → **App Previews and Screenshots** → **iPhone 6.5"** (or the slot that accepts 1242×2688):

| # | File | Shows |
|---|------|--------|
| 1 | `screenshots/01-home.png` | Hub / tool list |
| 2 | `screenshots/02-slabcrack.png` | SlabCrack |
| 3 | `screenshots/03-slablab.png` | SlabLab scanner |
| 4 | `screenshots/04-pokematch.png` | PokeMatch binder |
| 5 | `screenshots/05-pokewatch.png` | PokeWatch |
| 6 | `screenshots/06-pricing-plans.png` | Pricing plans |
| 7 | `screenshots/07-pricing.png` | Pricing (top) |
| 8 | `screenshots/08-signin.png` | Sign in |
| 9 | `screenshots/09-home-tools.png` | Hub scrolled |
| 10 | `screenshots/10-slablab-cards.png` | SlabLab card ROI list |

Drag them into the Screenshots slots in that order.

## App Previews (3 videos)

| # | File | Content |
|---|------|---------|
| 1 | `previews/preview-01-hub.mp4` | Hub → tools → pricing |
| 2 | `previews/preview-02-tools.mp4` | SlabCrack → SlabLab → PokeMatch |
| 3 | `previews/preview-03-alerts.mp4` | PokeWatch → pricing → sign in |

Upload these into the **App Preview** slots (above screenshots). They’re ~9s slideshow clips.

**Note:** Apple prefers real device screen recordings. If review pushes back on slideshow previews, re-record 15–30s on an iPhone (Control Center → Screen Recording) while tapping through the app, then replace these files.

## Re-capture later

```bash
cd slab-crack-dashboard
node apps/pc-queue-watch/scripts/capture-store-screenshots.mjs
```
