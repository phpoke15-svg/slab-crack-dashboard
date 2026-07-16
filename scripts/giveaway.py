#!/usr/bin/env python3
"""
Monthly giveaway backend — active time, AMOE mail-in, monthly drawing.

Legal rules enforced:
  - Max 1 app-usage entry per calendar day
  - Max 28 total entries per month (app + mail-in combined)
  - Free: 30 active minutes/day for 1 entry; Premium: 15 minutes (double-time)
  - Mail-in: 7 entries per postcard, max 4 postcards/month, still capped at 28/month

Usage (SQLite demo):
  python scripts/giveaway.py init
  python scripts/giveaway.py record-time <user_id> <minutes>
  python scripts/giveaway.py mail-in <user_id> [--admin-note "..."]
  python scripts/giveaway.py draw 2026-07

For production Supabase/PostgreSQL, run supabase/giveaway.sql and point DATABASE_URL
at Postgres; the SQL in this module is parameterised and portable.
"""

from __future__ import annotations

import argparse
import random
import sqlite3
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Generator, Literal, Optional
from uuid import uuid4

# ─── Constants (must match official rules) ───────────────────────────────────

FREE_ACTIVE_MINUTES_REQUIRED = 30
PREMIUM_ACTIVE_MINUTES_REQUIRED = 15
MONTHLY_ENTRY_CAP = 28
DAILY_APP_ENTRY_CAP = 1
MAIL_IN_ENTRIES_PER_POSTCARD = 7
MAX_MAIL_IN_POSTCARDS_PER_MONTH = 4

EntrySource = Literal["app_usage", "mail_in"]

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "giveaway.sqlite"


@dataclass
class User:
    id: str
    is_premium: bool


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def month_period(d: Optional[date] = None) -> str:
    day = d or utc_today()
    return f"{day.year:04d}-{day.month:02d}"


# ─── Schema (SQLite; mirrors supabase/giveaway.sql) ──────────────────────────

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  is_premium INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_app_activity (
  user_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  entry_awarded INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, activity_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month_period TEXT NOT NULL,
  earned_on TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('app_usage', 'mail_in')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS giveaway_entries_one_app_per_day_idx
  ON giveaway_entries (user_id, earned_on)
  WHERE source = 'app_usage';

CREATE TABLE IF NOT EXISTS mail_in_postcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month_period TEXT NOT NULL,
  entries_awarded INTEGER NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS giveaway_entries_month_idx
  ON giveaway_entries (month_period, user_id);
"""


@contextmanager
def connect(db_path: Path = DEFAULT_DB) -> Generator[sqlite3.Connection, None, None]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Path = DEFAULT_DB) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA_SQL)


def ensure_user(conn: sqlite3.Connection, user_id: str, is_premium: bool = False) -> User:
    conn.execute(
        "INSERT OR IGNORE INTO users (id, is_premium) VALUES (?, ?)",
        (user_id, 1 if is_premium else 0),
    )
    row = conn.execute("SELECT id, is_premium FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise ValueError(f"User {user_id} not found")
    return User(id=row["id"], is_premium=bool(row["is_premium"]))


def count_month_entries(conn: sqlite3.Connection, user_id: str, period: str) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM giveaway_entries WHERE user_id = ? AND month_period = ?",
        (user_id, period),
    ).fetchone()
    return int(row["c"])


def count_mail_in_postcards(conn: sqlite3.Connection, user_id: str, period: str) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM mail_in_postcards WHERE user_id = ? AND month_period = ?",
        (user_id, period),
    ).fetchone()
    return int(row["c"])


def remaining_month_entries(conn: sqlite3.Connection, user_id: str, period: str) -> int:
    return max(0, MONTHLY_ENTRY_CAP - count_month_entries(conn, user_id, period))


def insert_entries(
    conn: sqlite3.Connection,
    user_id: str,
    period: str,
    earned_on: date,
    source: EntrySource,
    count: int,
) -> int:
    """Insert `count` individual giveaway rows. Returns rows inserted."""
    if count <= 0:
        return 0
    remaining = remaining_month_entries(conn, user_id, period)
    to_insert = min(count, remaining)
    for _ in range(to_insert):
        conn.execute(
            """
            INSERT INTO giveaway_entries (id, user_id, month_period, earned_on, source)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(uuid4()), user_id, period, earned_on.isoformat(), source),
        )
    return to_insert


def record_active_time(
    conn: sqlite3.Connection,
    user_id: str,
    minutes_added: int,
    *,
    on_date: Optional[date] = None,
) -> dict:
    """
    Add active minutes for today. Award 1 daily entry when tier threshold is met.

    Returns a status dict suitable for API responses.
    """
    if minutes_added <= 0:
        raise ValueError("minutes_added must be positive")

    today = on_date or utc_today()
    period = month_period(today)
    user = ensure_user(conn, user_id)

    if remaining_month_entries(conn, user_id, period) <= 0:
        return {
            "awarded": False,
            "reason": "monthly_cap_reached",
            "month_entries": MONTHLY_ENTRY_CAP,
        }

    threshold = (
        PREMIUM_ACTIVE_MINUTES_REQUIRED if user.is_premium else FREE_ACTIVE_MINUTES_REQUIRED
    )

    row = conn.execute(
        """
        SELECT active_minutes, entry_awarded
        FROM daily_app_activity
        WHERE user_id = ? AND activity_date = ?
        """,
        (user_id, today.isoformat()),
    ).fetchone()

    if row and bool(row["entry_awarded"]):
        return {
            "awarded": False,
            "reason": "daily_entry_already_awarded",
            "active_minutes": int(row["active_minutes"]),
            "threshold_minutes": threshold,
        }

    prev_minutes = int(row["active_minutes"]) if row else 0
    new_minutes = prev_minutes + minutes_added

    conn.execute(
        """
        INSERT INTO daily_app_activity (user_id, activity_date, active_minutes, entry_awarded)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(user_id, activity_date) DO UPDATE SET
          active_minutes = excluded.active_minutes,
          updated_at = datetime('now')
        """,
        (user_id, today.isoformat(), new_minutes),
    )

    if new_minutes < threshold:
        return {
            "awarded": False,
            "reason": "below_threshold",
            "active_minutes": new_minutes,
            "threshold_minutes": threshold,
            "minutes_remaining": threshold - new_minutes,
        }

    # Threshold met — award exactly 1 entry for the day (subject to monthly cap).
    inserted = insert_entries(conn, user_id, period, today, "app_usage", DAILY_APP_ENTRY_CAP)
    if inserted == 0:
        return {
            "awarded": False,
            "reason": "monthly_cap_reached",
            "active_minutes": new_minutes,
            "threshold_minutes": threshold,
        }

    conn.execute(
        """
        UPDATE daily_app_activity
        SET entry_awarded = 1, updated_at = datetime('now')
        WHERE user_id = ? AND activity_date = ?
        """,
        (user_id, today.isoformat()),
    )

    return {
        "awarded": True,
        "entries_added": inserted,
        "active_minutes": new_minutes,
        "threshold_minutes": threshold,
        "month_entries": count_month_entries(conn, user_id, period),
        "month_entries_remaining": remaining_month_entries(conn, user_id, period),
    }


def add_mail_in_entries(
    conn: sqlite3.Connection,
    user_id: str,
    quantity: int = MAIL_IN_ENTRIES_PER_POSTCARD,
    *,
    admin_note: str = "",
    on_date: Optional[date] = None,
) -> dict:
    """
    Admin: credit AMOE mail-in entries for one processed postcard.

    Each postcard defaults to 7 entries. Caps:
      - 4 postcards per user per month
      - 28 total entries per month (combined with app usage)
    """
    if quantity <= 0:
        raise ValueError("quantity must be positive")

    today = on_date or utc_today()
    period = month_period(today)
    ensure_user(conn, user_id)

    postcards_used = count_mail_in_postcards(conn, user_id, period)
    if postcards_used >= MAX_MAIL_IN_POSTCARDS_PER_MONTH:
        return {
            "awarded": False,
            "reason": "max_postcards_for_month",
            "postcards_used": postcards_used,
            "max_postcards": MAX_MAIL_IN_POSTCARDS_PER_MONTH,
        }

    remaining = remaining_month_entries(conn, user_id, period)
    if remaining <= 0:
        return {
            "awarded": False,
            "reason": "monthly_cap_reached",
            "month_entries": MONTHLY_ENTRY_CAP,
        }

    to_award = min(quantity, remaining)
    inserted = insert_entries(conn, user_id, period, today, "mail_in", to_award)

    conn.execute(
        """
        INSERT INTO mail_in_postcards (id, user_id, month_period, entries_awarded, notes)
        VALUES (?, ?, ?, ?, ?)
        """,
        (str(uuid4()), user_id, period, inserted, admin_note.strip()),
    )

    return {
        "awarded": inserted > 0,
        "entries_added": inserted,
        "entries_requested": quantity,
        "entries_capped_to": to_award,
        "postcards_used": postcards_used + 1,
        "month_entries": count_month_entries(conn, user_id, period),
        "month_entries_remaining": remaining_month_entries(conn, user_id, period),
    }


def draw_monthly_winner(conn: sqlite3.Connection, month: str) -> dict:
    """
    Random weighted draw: each giveaway_entries row is one ticket.
    More entries ⇒ proportionally higher odds.
    """
    rows = conn.execute(
        "SELECT user_id FROM giveaway_entries WHERE month_period = ?",
        (month,),
    ).fetchall()

    if not rows:
        return {"winner_user_id": None, "total_entries": 0, "unique_entrants": 0}

    tickets = [row["user_id"] for row in rows]
    winner = random.choice(tickets)

    unique = len(set(tickets))
    return {
        "winner_user_id": winner,
        "month_period": month,
        "total_entries": len(tickets),
        "unique_entrants": unique,
        "winner_entry_count": tickets.count(winner),
    }


# ─── CLI (local testing) ─────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Monthly giveaway backend (SQLite demo)")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite database path")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Create tables")

    seed = sub.add_parser("seed-user", help="Create a demo user")
    seed.add_argument("user_id")
    seed.add_argument("--premium", action="store_true")

    rt = sub.add_parser("record-time", help="Record active minutes")
    rt.add_argument("user_id")
    rt.add_argument("minutes", type=int)

    mi = sub.add_parser("mail-in", help="Admin mail-in postcard (7 entries)")
    mi.add_argument("user_id")
    mi.add_argument("--quantity", type=int, default=MAIL_IN_ENTRIES_PER_POSTCARD)
    mi.add_argument("--note", default="")

    dr = sub.add_parser("draw", help="Draw monthly winner")
    dr.add_argument("month_period", help="YYYY-MM")

    args = parser.parse_args(argv)

    if args.command == "init":
        init_db(args.db)
        print(f"Initialized {args.db}")
        return 0

    init_db(args.db)
    with connect(args.db) as conn:
        if args.command == "seed-user":
            ensure_user(conn, args.user_id, is_premium=args.premium)
            print(f"User {args.user_id} premium={args.premium}")
            return 0
        if args.command == "record-time":
            result = record_active_time(conn, args.user_id, args.minutes)
            print(result)
            return 0
        if args.command == "mail-in":
            result = add_mail_in_entries(
                conn, args.user_id, quantity=args.quantity, admin_note=args.note
            )
            print(result)
            return 0
        if args.command == "draw":
            result = draw_monthly_winner(conn, args.month_period)
            print(result)
            return 0

    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
