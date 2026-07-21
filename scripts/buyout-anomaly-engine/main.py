#!/usr/bin/env python3
"""
TCG / Collectibles Buyout Warning Anomaly Engine.

Detects stealth market sweeps (volume spikes + listing depletion while price
is still flat) before retail prices move.

Run immediately with mock data:
  python scripts/buyout-anomaly-engine/main.py

Live mode (requires API keys in environment):
  python scripts/buyout-anomaly-engine/main.py --live
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

# Allow running as `python scripts/buyout-anomaly-engine/main.py`
ENGINE_DIR = Path(__file__).resolve().parent
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

from analyzer import detect_stealth_buyouts  # noqa: E402
from api_clients import EbayClient, PriceChartingClient  # noqa: E402
from database import SnapshotDatabase, SnapshotRecord  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("buyout-anomaly-engine")

MOCK_CARDS = [
    {
        "card_id": "sv-161",
        "title": "Charizard ex (151)",
        "console": "Pokemon Scarlet & Violet 151",
        "keyword": "Charizard ex 151 pokemon card",
    },
    {
        "card_id": "sv-205",
        "title": "Mew ex (151)",
        "console": "Pokemon Scarlet & Violet 151",
        "keyword": "Mew ex 151 pokemon card",
    },
]


def _utc_iso(day_offset: int = 0) -> str:
    return (
        datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
        - timedelta(days=day_offset)
    ).isoformat()


def build_mock_history() -> list[SnapshotRecord]:
    """
    Synthetic 15-day history with one stealth buyout on Charizard ex.

    Days 0-13: quiet baseline (low volume, stable listings, flat price).
    Day 0 (latest): sweep day — volume spike, listings collapse, price still flat.
    Mew ex control card stays quiet throughout.
    """
    records: list[SnapshotRecord] = []

    for day in range(14, -1, -1):
        scanned_at = _utc_iso(day)

        # Control card — never alerts
        records.append(
            SnapshotRecord(
                card_id="sv-205",
                scanned_at=scanned_at,
                title="Mew ex (151)",
                console="Pokemon Scarlet & Violet 151",
                pricecharting_id="mock-mew-205",
                daily_volume=2 + (day % 3),
                unique_listings=46 - (day % 4),
                market_price=18.50 + (0.05 * (14 - day)),
                source="mock",
            )
        )

        if day >= 2:
            volume = 2 + (day % 2)
            listings = 58 - (day % 3)
            price = 42.00
        else:
            # Stealth sweep window on the latest two periods
            volume = 28 if day == 0 else 9
            listings = 18 if day == 0 else 34
            price = 42.25 if day == 0 else 42.00

        records.append(
            SnapshotRecord(
                card_id="sv-161",
                scanned_at=scanned_at,
                title="Charizard ex (151)",
                console="Pokemon Scarlet & Violet 151",
                pricecharting_id="mock-charizard-161",
                daily_volume=volume,
                unique_listings=listings,
                market_price=price,
                source="mock",
            )
        )

    return records


def run_live_scan(db: SnapshotDatabase, cards: list[dict[str, str]]) -> int:
    """Pull live API data for configured cards and persist snapshots."""
    pc = PriceChartingClient()
    ebay = EbayClient()
    inserted = 0

    for card in cards:
        product = pc.fetch_product_by_query(card["keyword"])
        snapshot = ebay.fetch_market_snapshot(card["card_id"], card["keyword"])
        db.insert_snapshot(
            SnapshotRecord(
                card_id=card["card_id"],
                scanned_at=SnapshotDatabase.utc_now_iso(),
                title=product.title,
                console=product.console,
                pricecharting_id=product.product_id,
                daily_volume=snapshot.daily_volume,
                unique_listings=snapshot.unique_listings,
                market_price=snapshot.market_price or product.price_usd,
                source="live",
            )
        )
        inserted += 1
        logger.info(
            "Live scan %s — volume=%s listings=%s price=$%.2f",
            card["card_id"],
            snapshot.daily_volume,
            snapshot.unique_listings,
            snapshot.market_price or product.price_usd,
        )

    return inserted


def load_dataframe(db: SnapshotDatabase) -> pd.DataFrame:
    rows = db.load_snapshots()
    return pd.DataFrame(
        [
            {
                "card_id": row["card_id"],
                "scanned_at": row["scanned_at"],
                "daily_volume": row["daily_volume"],
                "unique_listings": row["unique_listings"],
                "market_price": row["market_price"],
            }
            for row in rows
        ]
    )


def print_alerts(alerts: pd.DataFrame) -> None:
    flagged = alerts[alerts["stealth_buyout_alert"]]
    if flagged.empty:
        print("\nNo stealth buyout alerts on the latest scan window.")
        return

    print("\n=== STEALTH BUYOUT ALERTS ===")
    for _, row in flagged.iterrows():
        print(
            f"\n• {row['card_id']}"
            f"\n  volume_z={row['volume_z_score']:.2f}"
            f"  listings_z={row['listings_z_score']:.2f}"
            f"  price_chg={row['price_pct_change']:.2%}"
            f"\n  daily_volume={int(row['daily_volume'])}"
            f"  unique_listings={int(row['unique_listings'])}"
            f"  market_price=${row['market_price']:.2f}"
            f"\n  scanned_at={row['scanned_at']}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="TCG stealth buyout anomaly engine")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Pull live PriceCharting + eBay data (requires API keys)",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="SQLite database path (default: data/buyout_anomaly.sqlite)",
    )
    args = parser.parse_args()

    db = SnapshotDatabase(args.db) if args.db else SnapshotDatabase()
    db.initialize()

    if args.live:
        logger.info("Running live API scan…")
        run_live_scan(db, MOCK_CARDS)
    else:
        logger.info("Seeding mock time-series snapshots…")
        db.insert_many(build_mock_history())

    df = load_dataframe(db)
    if df.empty:
        logger.error("No snapshots found — nothing to analyze.")
        return 1

    alerts = detect_stealth_buyouts(df)
    print_alerts(alerts)

    preview = alerts[
        [
            "card_id",
            "scanned_at",
            "daily_volume",
            "unique_listings",
            "market_price",
            "volume_z_score",
            "listings_z_score",
            "price_pct_change",
            "stealth_buyout_alert",
        ]
    ]
    print("\nLatest per-card metrics:")
    print(preview.to_string(index=False))

    triggered = bool(alerts["stealth_buyout_alert"].any())
    if not args.live and not triggered:
        logger.warning("Mock simulation did not trigger — check synthetic data.")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
