"""Pandas math for stealth buyout / inventory velocity anomaly detection."""

from __future__ import annotations

import numpy as np
import pandas as pd

BASELINE_WINDOW = 14
VOLUME_Z_THRESHOLD = 3.0
LISTINGS_Z_THRESHOLD = -2.0
MAX_PRICE_PCT_CHANGE = 0.05
MAX_UNIQUE_LISTINGS_FOR_ALERT = 80
LISTING_SANITY_VOLUME_RATIO = 1.5


def _rolling_zscore(series: pd.Series, window: int = BASELINE_WINDOW) -> pd.Series:
    """Z-score of the current value vs a rolling historical baseline."""
    rolling_mean = series.rolling(window=window, min_periods=window).mean().shift(1)
    rolling_std = series.rolling(window=window, min_periods=window).std(ddof=0).shift(1)
    z = (series - rolling_mean) / rolling_std.replace(0, np.nan)
    return z.replace([np.inf, -np.inf], np.nan)


def _inventory_explained_by_sales(listing_delta: float, daily_volume: float) -> bool:
    """
  Data sanity guard: listing contraction should be explained by observed sales.

  Reject cases where listings vanished without matching transactional volume
  (likely bulk unlists rather than organic buyouts).
    """
    if listing_delta >= 0:
        return True
    explained_threshold = max(daily_volume, 1) * LISTING_SANITY_VOLUME_RATIO
    return abs(listing_delta) <= explained_threshold


def detect_stealth_buyouts(df: pd.DataFrame) -> pd.DataFrame:
    """
    Flag stealth market sweeps before price spikes.

    Required columns:
      - card_id
      - scanned_at (sortable timestamp)
      - daily_volume
      - unique_listings
      - market_price

    Alert when ALL conditions pass on the latest period per card:
      1. volume_z_score >= 3.0
      2. listings_z_score <= -2.0
      3. abs(price_pct_change over last 2 periods) <= 0.05
      4. unique_listings <= 80 (supply floor guard)
      5. listing drop matches logged sales volume (sanity check)
    """
    required = {"card_id", "scanned_at", "daily_volume", "unique_listings", "market_price"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    work = df.copy()
    work["scanned_at"] = pd.to_datetime(work["scanned_at"], utc=True)
    work = work.sort_values(["card_id", "scanned_at"]).reset_index(drop=True)

    frames: list[pd.DataFrame] = []
    for card_id, group in work.groupby("card_id", sort=False):
        g = group.copy()
        g["listings_delta"] = g["unique_listings"].diff().fillna(0)
        g["volume_z_score"] = _rolling_zscore(g["daily_volume"].astype(float))
        g["listings_z_score"] = _rolling_zscore(g["listings_delta"].astype(float))
        g["price_pct_change"] = g["market_price"].pct_change(periods=2)
        g["card_id"] = card_id
        frames.append(g)

    enriched = pd.concat(frames, ignore_index=True)
    latest = enriched.sort_values("scanned_at").groupby("card_id", as_index=False).tail(1)

    latest["supply_floor_ok"] = latest["unique_listings"] <= MAX_UNIQUE_LISTINGS_FOR_ALERT
    latest["volume_spike"] = latest["volume_z_score"] >= VOLUME_Z_THRESHOLD
    latest["listing_contraction"] = latest["listings_z_score"] <= LISTINGS_Z_THRESHOLD
    latest["price_flat"] = latest["price_pct_change"].abs() <= MAX_PRICE_PCT_CHANGE
    latest["inventory_sanity_ok"] = latest.apply(
        lambda row: _inventory_explained_by_sales(
            float(row["listings_delta"]) if pd.notna(row["listings_delta"]) else 0.0,
            float(row["daily_volume"]),
        ),
        axis=1,
    )

    latest["stealth_buyout_alert"] = (
        latest["supply_floor_ok"]
        & latest["volume_spike"]
        & latest["listing_contraction"]
        & latest["price_flat"]
        & latest["inventory_sanity_ok"]
    )

    return latest.sort_values(
        ["stealth_buyout_alert", "volume_z_score"],
        ascending=[False, False],
    ).reset_index(drop=True)
