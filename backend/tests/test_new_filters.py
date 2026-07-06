"""Tests for the newly exposed fundamentals/technicals filters:
EPS growth, quick ratio, RSI, SMA position, and 52-week range position.
Missing data always passes — a filter never silently excludes a stock whose
data the provider couldn't supply.
"""
from __future__ import annotations

from app.data.provider import StockQuote
from app.screener.filters import FundamentalsFilter, _52w_position


def _q(**overrides) -> StockQuote:
    base = dict(
        ticker="TST",
        price=100.0,
        name="Test Co",
        avg_volume=1_000_000,
    )
    base.update(overrides)
    return StockQuote(**base)


def _f(**kwargs) -> FundamentalsFilter:
    return FundamentalsFilter(**kwargs)


# ── EPS growth ────────────────────────────────────────────────────────────────

def test_eps_growth_passes_above() -> None:
    assert _f(min_eps_growth=0.10).passes(_q(eps_growth=0.15)) is True


def test_eps_growth_fails_below() -> None:
    assert _f(min_eps_growth=0.10).passes(_q(eps_growth=0.05)) is False


def test_eps_growth_none_passes() -> None:
    assert _f(min_eps_growth=0.10).passes(_q(eps_growth=None)) is True


# ── Quick ratio ───────────────────────────────────────────────────────────────

def test_quick_ratio_passes() -> None:
    assert _f(min_quick_ratio=1.0).passes(_q(quick_ratio=1.5)) is True


def test_quick_ratio_fails() -> None:
    assert _f(min_quick_ratio=1.0).passes(_q(quick_ratio=0.8)) is False


# ── RSI ───────────────────────────────────────────────────────────────────────

def test_rsi_band() -> None:
    f = _f(min_rsi=30.0, max_rsi=70.0)
    assert f.passes(_q(rsi_14=50.0)) is True
    assert f.passes(_q(rsi_14=25.0)) is False
    assert f.passes(_q(rsi_14=75.0)) is False
    assert f.passes(_q(rsi_14=None)) is True


# ── SMA position ──────────────────────────────────────────────────────────────

def test_above_sma_50() -> None:
    assert _f(above_sma_50=True).passes(_q(price=110.0, sma_50=100.0)) is True
    assert _f(above_sma_50=True).passes(_q(price=90.0, sma_50=100.0)) is False
    assert _f(above_sma_50=False).passes(_q(price=90.0, sma_50=100.0)) is True
    assert _f(above_sma_50=True).passes(_q(price=110.0, sma_50=None)) is True


def test_above_sma_200() -> None:
    assert _f(above_sma_200=True).passes(_q(price=210.0, sma_200=200.0)) is True
    assert _f(above_sma_200=True).passes(_q(price=190.0, sma_200=200.0)) is False


# ── 52-week position ──────────────────────────────────────────────────────────

def test_52w_position_math() -> None:
    q = _q(price=75.0, fifty_two_week_low=50.0, fifty_two_week_high=100.0)
    assert _52w_position(q) == 0.5


def test_52w_position_none_when_data_missing() -> None:
    assert _52w_position(_q(fifty_two_week_low=50.0)) is None
    assert _52w_position(_q(fifty_two_week_high=100.0)) is None


def test_52w_filter_near_high() -> None:
    near_high = _q(price=95.0, fifty_two_week_low=50.0, fifty_two_week_high=100.0)
    near_low = _q(price=55.0, fifty_two_week_low=50.0, fifty_two_week_high=100.0)
    f = _f(min_52w_position=0.75)
    assert f.passes(near_high) is True
    assert f.passes(near_low) is False


def test_52w_filter_near_low() -> None:
    near_low = _q(price=55.0, fifty_two_week_low=50.0, fifty_two_week_high=100.0)
    f = _f(max_52w_position=0.25)
    assert f.passes(near_low) is True


def test_52w_filter_missing_data_passes() -> None:
    assert _f(min_52w_position=0.75).passes(_q()) is True
