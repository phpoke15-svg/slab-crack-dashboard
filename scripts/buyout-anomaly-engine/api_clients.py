"""External API clients for TCG market data pulls."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

PRICECHARTING_BASE_URL = "https://www.pricecharting.com/api/product"
EBAY_BROWSE_BASE_URL = "https://api.ebay.com/buy/browse/v1"
EBAY_FINDING_BASE_URL = "https://svcs.ebay.com/services/search/FindingService/v1"


@dataclass(frozen=True)
class PriceChartingProduct:
    """Normalized PriceCharting product baseline."""

    product_id: str
    title: str
    console: str
    price_usd: float


@dataclass(frozen=True)
class MarketSnapshot:
    """Per-scan velocity metrics for a card keyword."""

    card_id: str
    keyword: str
    daily_volume: int
    unique_listings: int
    market_price: float
    source: str


class RateLimiter:
    """Simple token-bucket style spacing between HTTP calls."""

    def __init__(self, min_interval_seconds: float = 0.25) -> None:
        self._min_interval = min_interval_seconds
        self._last_call = 0.0

    def wait(self) -> None:
        elapsed = time.monotonic() - self._last_call
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_call = time.monotonic()


class PriceChartingClient:
    """PriceCharting product lookup client."""

    def __init__(
        self,
        token: Optional[str] = None,
        session: Optional[requests.Session] = None,
        rate_limiter: Optional[RateLimiter] = None,
    ) -> None:
        self.token = token or os.getenv("PRICECHARTING_API_KEY", "").strip()
        self.session = session or requests.Session()
        self.rate_limiter = rate_limiter or RateLimiter()

    def fetch_product_by_query(self, query: str) -> PriceChartingProduct:
        """
        Fetch baseline product info using a text query.

        Docs: GET https://www.pricecharting.com/api/product?q=...&t=TOKEN
        """
        if not self.token:
            raise ValueError("PRICECHARTING_API_KEY is required for live PriceCharting calls")

        params = {"q": query, "t": self.token}
        self.rate_limiter.wait()
        response = self.session.get(PRICECHARTING_BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()

        if payload.get("status") == "error":
            raise RuntimeError(payload.get("error-message", "PriceCharting API error"))

        product_id = str(payload.get("id", "")).strip()
        if not product_id:
            raise RuntimeError(f"No PriceCharting product match for query: {query}")

        price_cents = payload.get("price")
        price_usd = round(float(price_cents) / 100.0, 2) if price_cents is not None else 0.0

        return PriceChartingProduct(
            product_id=product_id,
            title=str(payload.get("product-name", query)).strip(),
            console=str(payload.get("console-name", "unknown")).strip(),
            price_usd=price_usd,
        )


class EbayClient:
    """
    eBay market velocity client.

    Primary path: Finding API `findCompletedItems` for sold comps (14-day window).
    Secondary path: Browse API `item_summary/search` for active listing counts.
    """

    def __init__(
        self,
        app_id: Optional[str] = None,
        oauth_token: Optional[str] = None,
        session: Optional[requests.Session] = None,
        rate_limiter: Optional[RateLimiter] = None,
    ) -> None:
        self.app_id = app_id or os.getenv("EBAY_APP_ID", "").strip()
        self.oauth_token = oauth_token or os.getenv("EBAY_OAUTH_TOKEN", "").strip()
        self.session = session or requests.Session()
        self.rate_limiter = rate_limiter or RateLimiter(min_interval_seconds=0.35)

    def fetch_market_snapshot(self, card_id: str, keyword: str) -> MarketSnapshot:
        """Pull sold velocity + active listing density for a keyword."""
        sold_items = self._fetch_completed_items(keyword, days=14)
        daily_volume = self._count_last_24h_sales(sold_items)
        market_price = self._average_last_n_prices(sold_items, n=5)
        unique_listings = self._fetch_active_listing_count(keyword)

        return MarketSnapshot(
            card_id=card_id,
            keyword=keyword,
            daily_volume=daily_volume,
            unique_listings=unique_listings,
            market_price=market_price,
            source="ebay",
        )

    def _fetch_completed_items(self, keyword: str, days: int = 14) -> list[dict[str, Any]]:
        if not self.app_id:
            raise ValueError("EBAY_APP_ID is required for live eBay Finding API calls")

        params = {
            "OPERATION-NAME": "findCompletedItems",
            "SERVICE-VERSION": "1.13.0",
            "SECURITY-APPNAME": self.app_id,
            "RESPONSE-DATA-FORMAT": "JSON",
            "REST-PAYLOAD": "",
            "keywords": keyword,
            "paginationInput.entriesPerPage": "100",
            "itemFilter(0).name": "SoldItemsOnly",
            "itemFilter(0).value": "true",
            "itemFilter(1).name": "EndTimeFrom",
            "itemFilter(1).value": self._iso_days_ago(days),
        }

        self.rate_limiter.wait()
        response = self.session.get(EBAY_FINDING_BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()

        search_result = (
            payload.get("findCompletedItemsResponse", [{}])[0]
            .get("searchResult", [{}])[0]
        )
        items = search_result.get("item", []) or []
        return items if isinstance(items, list) else [items]

    def _fetch_active_listing_count(self, keyword: str) -> int:
        if not self.oauth_token:
            logger.warning("EBAY_OAUTH_TOKEN missing; estimating listings from sold sample size")
            return 0

        params = {
            "q": keyword,
            "limit": "50",
            "filter": "conditions:{NEW|USED},buyingOptions:{FIXED_PRICE}",
        }
        headers = {
            "Authorization": f"Bearer {self.oauth_token}",
            "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        }

        self.rate_limiter.wait()
        response = self.session.get(
            f"{EBAY_BROWSE_BASE_URL}/item_summary/search",
            params=params,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        total = payload.get("total", 0)
        if isinstance(total, int):
            return total
        return int(payload.get("itemSummaries", []) and len(payload["itemSummaries"]))

    @staticmethod
    def _iso_days_ago(days: int) -> str:
        from datetime import datetime, timedelta, timezone

        return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    @staticmethod
    def _parse_end_time(item: dict[str, Any]) -> Optional[float]:
        end_time = item.get("listingInfo", [{}])[0].get("endTime", [None])[0]
        if not end_time:
            return None
        from datetime import datetime

        try:
            return datetime.fromisoformat(end_time.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None

    def _count_last_24h_sales(self, items: list[dict[str, Any]]) -> int:
        from datetime import datetime, timedelta, timezone

        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        count = 0
        for item in items:
            end_ts = self._parse_end_time(item)
            if end_ts is None:
                continue
            if datetime.fromtimestamp(end_ts, tz=timezone.utc) >= cutoff:
                count += 1
        return count

    @staticmethod
    def _average_last_n_prices(items: list[dict[str, Any]], n: int = 5) -> float:
        prices: list[float] = []
        for item in items[:n]:
            raw = item.get("sellingStatus", [{}])[0].get("currentPrice", [{}])[0].get("__value__")
            if raw is None:
                continue
            try:
                prices.append(float(raw))
            except (TypeError, ValueError):
                continue
        if not prices:
            return 0.0
        return round(sum(prices) / len(prices), 2)
