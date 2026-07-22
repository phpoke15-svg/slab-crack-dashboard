# App Store Connect — subscription review screenshots

Use these when Apple asks for a **screenshot** on each In-App Purchase subscription.

| File | Upload to product ID |
|------|----------------------|
| `collectools-premium-plan.png` | `collectools_premium_monthly` (and yearly if asked) |
| `collectools-pro-plan.png` | `collectools_pro_monthly` (and yearly if asked) |

Size: **1290 × 2796** (iPhone 6.7"). Captured with `html.native-app` so **no Google Play** badges appear.

## Regenerate (no iPhone needed)

```bash
node apps/pc-queue-watch/scripts/capture-iap-review-screenshots.mjs
```

## Where to upload

App Store Connect → **Subscriptions** → open product → **Review Information** → **Screenshot** → drag PNG.
