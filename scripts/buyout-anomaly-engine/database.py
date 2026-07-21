"""SQLite persistence for card market snapshot time series."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator, Iterable, Optional

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "buyout_anomaly.sqlite"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS market_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    title TEXT,
    console TEXT,
    pricecharting_id TEXT,
    daily_volume INTEGER NOT NULL DEFAULT 0,
    unique_listings INTEGER NOT NULL DEFAULT 0,
    market_price REAL NOT NULL DEFAULT 0.0,
    source TEXT NOT NULL DEFAULT 'mock',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_card_time
    ON market_snapshots (card_id, scanned_at);
"""


@dataclass(frozen=True)
class SnapshotRecord:
    card_id: str
    scanned_at: str
    daily_volume: int
    unique_listings: int
    market_price: float
    title: Optional[str] = None
    console: Optional[str] = None
    pricecharting_id: Optional[str] = None
    source: str = "mock"


class SnapshotDatabase:
    """Thin SQLite wrapper for historical market snapshots."""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA_SQL)

    def insert_snapshot(self, record: SnapshotRecord) -> int:
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO market_snapshots (
                    card_id, scanned_at, title, console, pricecharting_id,
                    daily_volume, unique_listings, market_price, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.card_id,
                    record.scanned_at,
                    record.title,
                    record.console,
                    record.pricecharting_id,
                    record.daily_volume,
                    record.unique_listings,
                    record.market_price,
                    record.source,
                ),
            )
            return int(cursor.lastrowid)

    def insert_many(self, records: Iterable[SnapshotRecord]) -> int:
        rows = list(records)
        if not rows:
            return 0
        with self.connect() as conn:
            conn.executemany(
                """
                INSERT INTO market_snapshots (
                    card_id, scanned_at, title, console, pricecharting_id,
                    daily_volume, unique_listings, market_price, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        r.card_id,
                        r.scanned_at,
                        r.title,
                        r.console,
                        r.pricecharting_id,
                        r.daily_volume,
                        r.unique_listings,
                        r.market_price,
                        r.source,
                    )
                    for r in rows
                ],
            )
        return len(rows)

    def load_snapshots(self, card_id: Optional[str] = None) -> list[sqlite3.Row]:
        query = """
            SELECT card_id, scanned_at, daily_volume, unique_listings, market_price
            FROM market_snapshots
        """
        params: tuple[str, ...] = ()
        if card_id:
            query += " WHERE card_id = ?"
            params = (card_id,)
        query += " ORDER BY card_id, scanned_at"
        with self.connect() as conn:
            return list(conn.execute(query, params))

    @staticmethod
    def utc_now_iso() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
