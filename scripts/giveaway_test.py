"""Tests for scripts/giveaway.py — monthly caps, tiers, mail-in, drawing."""

from __future__ import annotations

import tempfile
import unittest
from datetime import date
from pathlib import Path

from scripts.giveaway import (
    FREE_ACTIVE_MINUTES_REQUIRED,
    MAIL_IN_ENTRIES_PER_POSTCARD,
    MONTHLY_ENTRY_CAP,
    PREMIUM_ACTIVE_MINUTES_REQUIRED,
    add_mail_in_entries,
    connect,
    draw_monthly_winner,
    ensure_user,
    init_db,
    month_period,
    record_active_time,
)


class GiveawayTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "test.sqlite"
        init_db(self.db)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_free_user_needs_30_minutes(self) -> None:
        today = date(2026, 7, 15)
        with connect(self.db) as conn:
            ensure_user(conn, "free-user", is_premium=False)
            r1 = record_active_time(conn, "free-user", 20, on_date=today)
            self.assertFalse(r1["awarded"])
            self.assertEqual(r1["reason"], "below_threshold")

            r2 = record_active_time(conn, "free-user", 10, on_date=today)
            self.assertTrue(r2["awarded"])
            self.assertEqual(r2["entries_added"], 1)

    def test_premium_user_needs_15_minutes(self) -> None:
        today = date(2026, 7, 15)
        with connect(self.db) as conn:
            ensure_user(conn, "pro-user", is_premium=True)
            r1 = record_active_time(conn, "pro-user", 14, on_date=today)
            self.assertFalse(r1["awarded"])

            r2 = record_active_time(conn, "pro-user", 1, on_date=today)
            self.assertTrue(r2["awarded"])

    def test_only_one_app_entry_per_day(self) -> None:
        today = date(2026, 7, 16)
        with connect(self.db) as conn:
            ensure_user(conn, "u1", is_premium=True)
            record_active_time(conn, "u1", 20, on_date=today)
            again = record_active_time(conn, "u1", 20, on_date=today)
            self.assertFalse(again["awarded"])
            self.assertEqual(again["reason"], "daily_entry_already_awarded")

    def test_monthly_cap_28(self) -> None:
        today = date(2026, 7, 1)
        period = month_period(today)
        with connect(self.db) as conn:
            ensure_user(conn, "heavy", is_premium=True)
            for day in range(1, 29):
                d = date(2026, 7, day)
                record_active_time(conn, "heavy", PREMIUM_ACTIVE_MINUTES_REQUIRED, on_date=d)

            extra = record_active_time(
                conn, "heavy", PREMIUM_ACTIVE_MINUTES_REQUIRED, on_date=date(2026, 7, 29)
            )
            self.assertFalse(extra["awarded"])
            self.assertEqual(extra["reason"], "monthly_cap_reached")

            winner_pool = draw_monthly_winner(conn, period)
            self.assertEqual(winner_pool["total_entries"], MONTHLY_ENTRY_CAP)

    def test_mail_in_respects_cap_and_postcard_limit(self) -> None:
        today = date(2026, 8, 5)
        with connect(self.db) as conn:
            ensure_user(conn, "mailer")
            # 4 postcards × 7 = 28 (full cap)
            for i in range(4):
                r = add_mail_in_entries(conn, "mailer", quantity=MAIL_IN_ENTRIES_PER_POSTCARD, on_date=today)
                self.assertTrue(r["awarded"])
                self.assertEqual(r["entries_added"], 7)

            fifth = add_mail_in_entries(conn, "mailer", on_date=today)
            self.assertFalse(fifth["awarded"])
            self.assertEqual(fifth["reason"], "max_postcards_for_month")

    def test_mail_in_partial_when_near_cap(self) -> None:
        today = date(2026, 9, 1)
        with connect(self.db) as conn:
            ensure_user(conn, "mix", is_premium=True)
            # 27 entries via app (27 days)
            for day in range(1, 28):
                record_active_time(
                    conn,
                    "mix",
                    PREMIUM_ACTIVE_MINUTES_REQUIRED,
                    on_date=date(2026, 9, day),
                )
            mail = add_mail_in_entries(conn, "mix", quantity=7, on_date=date(2026, 9, 28))
            self.assertTrue(mail["awarded"])
            self.assertEqual(mail["entries_added"], 1)
            self.assertEqual(mail["entries_capped_to"], 1)

    def test_draw_weighted_by_entry_count(self) -> None:
        period = "2026-07"
        with connect(self.db) as conn:
            ensure_user(conn, "a")
            ensure_user(conn, "b")
            add_mail_in_entries(conn, "a", quantity=28, on_date=date(2026, 7, 1))
            add_mail_in_entries(conn, "b", quantity=7, on_date=date(2026, 7, 2))

            pool = draw_monthly_winner(conn, period)
            self.assertEqual(pool["total_entries"], 28 + 7)
            self.assertIn(pool["winner_user_id"], ("a", "b"))

        with connect(self.db) as conn:
            result = draw_monthly_winner(conn, "2099-01")
            self.assertIsNone(result["winner_user_id"])


if __name__ == "__main__":
    unittest.main()
