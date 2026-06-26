"""Phase 3 extension tests.

Covers:
- FundamentalsFilter new fields: max_beta, min_roe, max_peg, sector_filter,
  max_analyst_rating — happy path and None-field pass-through.
- iv_rank best-effort formula: computed inline to match the yfinance provider
  logic without importing the provider (pure unit, no I/O).
"""
from __future__ import annotations

import pytest

from app.data.provider import OptionContract, StockQuote
from app.screener.filters import FundamentalsFilter

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_quote(**kwargs) -> StockQuote:
    defaults = dict(
        ticker="TST",
        price=100.0,
        name="Test Co",
        market_cap=20_000_000_000,
        pe_ratio=20.0,
        avg_volume=2_000_000,
        beta=1.0,
        roe=0.15,
        peg_ratio=1.5,
        sector="Technology",
        analyst_rating=2.0,
    )
    return StockQuote(**{**defaults, **kwargs})


def _make_contract(**kwargs) -> OptionContract:
    defaults = dict(
        ticker="TST",
        strike=105.0,
        expiry="2024-02-16",
        dte=28,
        premium=4.0,
        bid=3.8,
        ask=4.2,
        volume=500,
        open_interest=2000,
        implied_volatility=0.25,
        earnings_within_dte=False,
    )
    return OptionContract(**{**defaults, **kwargs})


# ---------------------------------------------------------------------------
# max_beta
# ---------------------------------------------------------------------------


def test_max_beta_passes_under_limit() -> None:
    f = FundamentalsFilter(max_beta=1.5)
    assert f.passes(_make_quote(beta=1.2)) is True


def test_max_beta_fails_over_limit() -> None:
    f = FundamentalsFilter(max_beta=1.5)
    assert f.passes(_make_quote(beta=2.0)) is False


def test_max_beta_none_on_quote_always_passes() -> None:
    """Unknown beta must not exclude the stock."""
    f = FundamentalsFilter(max_beta=1.0)
    assert f.passes(_make_quote(beta=None)) is True


def test_max_beta_none_filter_always_passes() -> None:
    """Filter not set — any beta value passes."""
    f = FundamentalsFilter(max_beta=None)
    assert f.passes(_make_quote(beta=5.0)) is True


# ---------------------------------------------------------------------------
# min_roe
# ---------------------------------------------------------------------------


def test_min_roe_passes_above_threshold() -> None:
    f = FundamentalsFilter(min_roe=0.10)
    assert f.passes(_make_quote(roe=0.20)) is True


def test_min_roe_fails_below_threshold() -> None:
    f = FundamentalsFilter(min_roe=0.10)
    assert f.passes(_make_quote(roe=0.05)) is False


def test_min_roe_exact_threshold_passes() -> None:
    f = FundamentalsFilter(min_roe=0.10)
    assert f.passes(_make_quote(roe=0.10)) is True


def test_min_roe_none_on_quote_passes() -> None:
    f = FundamentalsFilter(min_roe=0.10)
    assert f.passes(_make_quote(roe=None)) is True


def test_min_roe_none_filter_passes() -> None:
    f = FundamentalsFilter(min_roe=None)
    assert f.passes(_make_quote(roe=0.0)) is True


# ---------------------------------------------------------------------------
# max_peg
# ---------------------------------------------------------------------------


def test_max_peg_passes_under_limit() -> None:
    f = FundamentalsFilter(max_peg=2.0)
    assert f.passes(_make_quote(peg_ratio=1.5)) is True


def test_max_peg_fails_over_limit() -> None:
    f = FundamentalsFilter(max_peg=2.0)
    assert f.passes(_make_quote(peg_ratio=3.0)) is False


def test_max_peg_none_on_quote_passes() -> None:
    f = FundamentalsFilter(max_peg=1.0)
    assert f.passes(_make_quote(peg_ratio=None)) is True


def test_max_peg_none_filter_passes() -> None:
    f = FundamentalsFilter(max_peg=None)
    assert f.passes(_make_quote(peg_ratio=99.0)) is True


# ---------------------------------------------------------------------------
# sector_filter
# ---------------------------------------------------------------------------


def test_sector_filter_passes_matching_sector() -> None:
    f = FundamentalsFilter(sector_filter=["Technology", "Healthcare"])
    assert f.passes(_make_quote(sector="Technology")) is True


def test_sector_filter_case_insensitive() -> None:
    f = FundamentalsFilter(sector_filter=["technology"])
    assert f.passes(_make_quote(sector="Technology")) is True


def test_sector_filter_fails_non_matching_sector() -> None:
    f = FundamentalsFilter(sector_filter=["Healthcare"])
    assert f.passes(_make_quote(sector="Technology")) is False


def test_sector_filter_none_on_quote_passes() -> None:
    """Unknown sector must not exclude the stock."""
    f = FundamentalsFilter(sector_filter=["Technology"])
    assert f.passes(_make_quote(sector=None)) is True


def test_sector_filter_none_filter_passes_any_sector() -> None:
    f = FundamentalsFilter(sector_filter=None)
    assert f.passes(_make_quote(sector="Energy")) is True


# ---------------------------------------------------------------------------
# max_analyst_rating
# ---------------------------------------------------------------------------


def test_analyst_rating_passes_strong_buy() -> None:
    # 1.0 = Strong Buy; max_analyst_rating=2.5 (Buy threshold)
    f = FundamentalsFilter(max_analyst_rating=2.5)
    assert f.passes(_make_quote(analyst_rating=1.5)) is True


def test_analyst_rating_fails_hold_or_worse() -> None:
    f = FundamentalsFilter(max_analyst_rating=2.5)
    assert f.passes(_make_quote(analyst_rating=3.0)) is False


def test_analyst_rating_exact_threshold_passes() -> None:
    f = FundamentalsFilter(max_analyst_rating=2.5)
    assert f.passes(_make_quote(analyst_rating=2.5)) is True


def test_analyst_rating_none_on_quote_passes() -> None:
    f = FundamentalsFilter(max_analyst_rating=2.5)
    assert f.passes(_make_quote(analyst_rating=None)) is True


def test_analyst_rating_none_filter_passes() -> None:
    f = FundamentalsFilter(max_analyst_rating=None)
    assert f.passes(_make_quote(analyst_rating=5.0)) is True


# ---------------------------------------------------------------------------
# Combined filter — all new fields together
# ---------------------------------------------------------------------------


def test_combined_new_filters_pass() -> None:
    f = FundamentalsFilter(
        max_beta=1.5,
        min_roe=0.10,
        max_peg=2.0,
        sector_filter=["Technology"],
        max_analyst_rating=2.5,
    )
    q = _make_quote(
        beta=1.2,
        roe=0.20,
        peg_ratio=1.5,
        sector="Technology",
        analyst_rating=2.0,
    )
    assert f.passes(q) is True


def test_combined_new_filters_fail_one_field() -> None:
    f = FundamentalsFilter(
        max_beta=1.5,
        min_roe=0.10,
        max_peg=2.0,
        sector_filter=["Technology"],
        max_analyst_rating=2.5,
    )
    # Only roe is below threshold
    q = _make_quote(
        beta=1.2,
        roe=0.05,
        peg_ratio=1.5,
        sector="Technology",
        analyst_rating=2.0,
    )
    assert f.passes(q) is False


# ---------------------------------------------------------------------------
# OptionContract new fields default to None (non-breaking)
# ---------------------------------------------------------------------------


def test_option_contract_new_fields_default_none() -> None:
    c = _make_contract()
    assert c.delta is None
    assert c.gamma is None
    assert c.theta is None
    assert c.vega is None
    assert c.iv_rank is None


def test_option_contract_new_fields_accept_values() -> None:
    c = _make_contract(delta=0.45, gamma=0.02, theta=-0.05, vega=0.12, iv_rank=55.0)
    assert c.delta == pytest.approx(0.45)
    assert c.gamma == pytest.approx(0.02)
    assert c.theta == pytest.approx(-0.05)
    assert c.vega == pytest.approx(0.12)
    assert c.iv_rank == pytest.approx(55.0)


# ---------------------------------------------------------------------------
# iv_rank computation — pure formula test (no I/O, mirrors yfinance_provider)
# ---------------------------------------------------------------------------


def _compute_iv_rank(iv_values: list[float], current_iv: float) -> float | None:
    """Mirror of the formula in YFinanceProvider._fetch_call_options."""
    if not iv_values:
        return None
    iv_min = min(iv_values)
    iv_max = max(iv_values)
    iv_range = iv_max - iv_min
    if iv_range <= 0:
        return None
    return (current_iv - iv_min) / iv_range * 100


def test_iv_rank_lowest_iv_gives_zero() -> None:
    ivs = [0.20, 0.25, 0.30, 0.35, 0.40]
    assert _compute_iv_rank(ivs, 0.20) == pytest.approx(0.0)


def test_iv_rank_highest_iv_gives_100() -> None:
    ivs = [0.20, 0.25, 0.30, 0.35, 0.40]
    assert _compute_iv_rank(ivs, 0.40) == pytest.approx(100.0)


def test_iv_rank_midpoint() -> None:
    ivs = [0.20, 0.30, 0.40]
    # current_iv = 0.30 → (0.30 - 0.20) / (0.40 - 0.20) * 100 = 50.0
    assert _compute_iv_rank(ivs, 0.30) == pytest.approx(50.0)


def test_iv_rank_none_when_all_equal() -> None:
    ivs = [0.25, 0.25, 0.25]
    assert _compute_iv_rank(ivs, 0.25) is None


def test_iv_rank_none_when_single_contract() -> None:
    ivs = [0.30]
    assert _compute_iv_rank(ivs, 0.30) is None


def test_iv_rank_none_when_empty_list() -> None:
    assert _compute_iv_rank([], 0.30) is None


def test_iv_rank_arbitrary_values() -> None:
    # ivs range 0.10 to 0.50; current=0.35
    # (0.35 - 0.10) / (0.50 - 0.10) * 100 = 0.25 / 0.40 * 100 = 62.5
    ivs = [0.10, 0.20, 0.30, 0.40, 0.50]
    assert _compute_iv_rank(ivs, 0.35) == pytest.approx(62.5)
