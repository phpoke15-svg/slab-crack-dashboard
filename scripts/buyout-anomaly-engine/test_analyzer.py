"""Unit tests for stealth buyout detection."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

ENGINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ENGINE_DIR))

from analyzer import detect_stealth_buyouts  # noqa: E402


def _ts(day: int) -> str:
    return (datetime(2026, 7, 1, 12, tzinfo=timezone.utc) + timedelta(days=day)).isoformat()


def test_detects_stealth_buyout_pattern() -> None:
    rows = []
    for day in range(15):
        rows.append(
            {
                "card_id": "test-card",
                "scanned_at": _ts(day),
                "daily_volume": 2,
                "unique_listings": 55,
                "market_price": 10.0,
            }
        )

    rows[-2]["daily_volume"] = 8
    rows[-2]["unique_listings"] = 40
    rows[-1]["daily_volume"] = 30
    rows[-1]["unique_listings"] = 15
    rows[-1]["market_price"] = 10.05

    alerts = detect_stealth_buyouts(pd.DataFrame(rows))
    latest = alerts.iloc[0]
    assert bool(latest["stealth_buyout_alert"]) is True
    assert latest["volume_z_score"] >= 3.0
    assert latest["listings_z_score"] <= -2.0


if __name__ == "__main__":
    test_detects_stealth_buyout_pattern()
    print("ok")
