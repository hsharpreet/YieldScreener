"""Golden tests for the cash-secured put and PMCC math, BS delta estimates,
and the new contract-level (Greek) filters.

Options math is the crown jewel — every function gets exact-value tests.
"""
from __future__ import annotations

import pytest

from app.data.provider import OptionContract
from app.options.greeks import bs_call_delta, bs_put_delta
from app.options.math import cash_secured_put_metrics, pmcc_metrics
from app.screener.filters import ContractFilter
from app.screener.ranker import (
    is_itm,
    rank_contracts,
    rank_pmcc,
    select_long_leg,
)


def _c(
    strike: float,
    premium: float,
    dte: int = 30,
    option_type: str = "call",
    delta: float | None = 0.30,
    expiry: str = "2026-08-07",
    iv_rank: float | None = 50.0,
    open_interest: int = 1000,
) -> OptionContract:
    return OptionContract(
        ticker="TST",
        strike=strike,
        expiry=expiry,
        dte=dte,
        premium=premium,
        bid=premium - 0.05,
        ask=premium + 0.05,
        volume=100,
        open_interest=open_interest,
        implied_volatility=0.25,
        earnings_within_dte=False,
        delta=delta,
        iv_rank=iv_rank,
        option_type=option_type,
    )


# ── Cash-secured put math ─────────────────────────────────────────────────────

def test_csp_golden() -> None:
    # price 100, strike 95, premium 2, dte 30
    m = cash_secured_put_metrics(price=100.0, strike=95.0, premium=2.0, dte=30)
    assert m.net_credit == pytest.approx(200.0)
    assert m.collateral == pytest.approx(9500.0)
    assert m.static_yield == pytest.approx(2.0 / 95.0)
    assert m.annualized_static == pytest.approx((2.0 / 95.0) * (365 / 30))
    assert m.breakeven == pytest.approx(93.0)
    assert m.discount_to_price == pytest.approx(0.07)   # (100 − 93) / 100
    assert m.max_profit == pytest.approx(200.0)


def test_csp_itm_put_breakeven_above_price() -> None:
    # ITM put: strike above price — breakeven can exceed price → negative discount
    m = cash_secured_put_metrics(price=100.0, strike=110.0, premium=3.0, dte=30)
    assert m.breakeven == pytest.approx(107.0)
    assert m.discount_to_price == pytest.approx(-0.07)


def test_csp_invalid_inputs_raise() -> None:
    with pytest.raises(ValueError):
        cash_secured_put_metrics(price=100.0, strike=95.0, premium=2.0, dte=0)
    with pytest.raises(ValueError):
        cash_secured_put_metrics(price=0.0, strike=95.0, premium=2.0, dte=30)
    with pytest.raises(ValueError):
        cash_secured_put_metrics(price=100.0, strike=0.0, premium=2.0, dte=30)
    with pytest.raises(ValueError):
        cash_secured_put_metrics(price=100.0, strike=95.0, premium=-1.0, dte=30)


# ── PMCC math ─────────────────────────────────────────────────────────────────

def test_pmcc_golden() -> None:
    # long: 70-strike LEAPS at $32 · short: 110-strike 30-dte at $2 · stock 100
    m = pmcc_metrics(
        price=100.0,
        long_strike=70.0,
        long_premium=32.0,
        short_strike=110.0,
        short_premium=2.0,
        short_dte=30,
    )
    assert m.capital_required == pytest.approx(3200.0)
    assert m.net_credit == pytest.approx(200.0)
    assert m.income_yield == pytest.approx(2.0 / 32.0)          # 6.25%
    assert m.annualized_income == pytest.approx((2.0 / 32.0) * (365 / 30))
    assert m.net_debit == pytest.approx(3000.0)
    assert m.breakeven == pytest.approx(100.0)                  # 70 + 30
    assert m.max_profit_if_called == pytest.approx(1000.0)      # (40 − 30) × 100
    assert m.assignment_safe is True                            # width 40 ≥ debit 30


def test_pmcc_unsafe_when_width_below_debit() -> None:
    # width 5 < net debit/share 29 → a called position locks in a loss
    m = pmcc_metrics(
        price=100.0,
        long_strike=95.0,
        long_premium=30.0,
        short_strike=100.0,
        short_premium=1.0,
        short_dte=30,
    )
    assert m.assignment_safe is False
    assert m.max_profit_if_called == pytest.approx(-2400.0)     # (5 − 29) × 100


def test_pmcc_short_strike_must_exceed_long_strike() -> None:
    with pytest.raises(ValueError):
        pmcc_metrics(
            price=100.0,
            long_strike=90.0,
            long_premium=15.0,
            short_strike=90.0,
            short_premium=1.0,
            short_dte=30,
        )


# ── Black-Scholes delta estimates ─────────────────────────────────────────────

def test_bs_delta_deep_itm_call_near_one() -> None:
    d = bs_call_delta(price=100.0, strike=50.0, dte=365, iv=0.25)
    assert d is not None and d > 0.95


def test_bs_delta_far_otm_call_near_zero() -> None:
    d = bs_call_delta(price=100.0, strike=200.0, dte=30, iv=0.25)
    assert d is not None and d < 0.05


def test_bs_delta_atm_call_near_half() -> None:
    d = bs_call_delta(price=100.0, strike=100.0, dte=30, iv=0.25)
    assert d is not None and 0.45 < d < 0.60


def test_bs_put_call_parity() -> None:
    call = bs_call_delta(price=100.0, strike=105.0, dte=45, iv=0.30)
    put = bs_put_delta(price=100.0, strike=105.0, dte=45, iv=0.30)
    assert call is not None and put is not None
    assert put == pytest.approx(call - 1.0)


def test_bs_delta_invalid_inputs_return_none() -> None:
    assert bs_call_delta(price=0.0, strike=100.0, dte=30, iv=0.25) is None
    assert bs_call_delta(price=100.0, strike=100.0, dte=0, iv=0.25) is None
    assert bs_call_delta(price=100.0, strike=100.0, dte=30, iv=0.0) is None


# ── ITM logic for puts vs calls ───────────────────────────────────────────────

def test_is_itm_put_flips() -> None:
    assert is_itm(_c(90.0, 1.0, option_type="call"), price=100.0) is True
    assert is_itm(_c(110.0, 1.0, option_type="call"), price=100.0) is False
    assert is_itm(_c(110.0, 1.0, option_type="put"), price=100.0) is True
    assert is_itm(_c(90.0, 1.0, option_type="put"), price=100.0) is False


def test_rank_contracts_puts_otm_only() -> None:
    contracts = [
        _c(110.0, 12.0, option_type="put", delta=-0.80),  # ITM put — excluded
        _c(95.0, 2.0, option_type="put", delta=-0.30),    # OTM put — kept
    ]
    ranked = rank_contracts(contracts, price=100.0)
    assert len(ranked) == 1
    assert ranked[0].contract.strike == 95.0
    assert ranked[0].metrics.collateral == pytest.approx(9500.0)


# ── PMCC leg selection & pairing ──────────────────────────────────────────────

def test_select_long_leg_prefers_min_extrinsic() -> None:
    leaps = [
        _c(70.0, 33.0, dte=365, delta=0.85),  # extrinsic 3.0
        _c(60.0, 41.5, dte=365, delta=0.90),  # extrinsic 1.5 — winner
        _c(95.0, 9.0, dte=365, delta=0.55),   # delta too low — not a candidate
    ]
    leg = select_long_leg(leaps, price=100.0)
    assert leg is not None and leg.strike == 60.0


def test_select_long_leg_strike_fallback_without_delta() -> None:
    leaps = [
        _c(75.0, 27.0, dte=400, delta=None),  # ≤ 80% of price → candidate
        _c(90.0, 14.0, dte=400, delta=None),  # 90% of price → excluded
    ]
    leg = select_long_leg(leaps, price=100.0)
    assert leg is not None and leg.strike == 75.0


def test_select_long_leg_none_when_no_deep_itm() -> None:
    assert select_long_leg([_c(98.0, 6.0, dte=365, delta=0.55)], price=100.0) is None


def test_rank_pmcc_excludes_unsafe_and_below_long_strike() -> None:
    long_leg = _c(70.0, 32.0, dte=365, delta=0.85)
    shorts = [
        _c(110.0, 2.0, dte=30, delta=0.25),   # safe: width 40 ≥ debit 30 — kept
        _c(95.0, 4.0, dte=30, delta=0.45),    # width 25 < debit 28 — dropped
        _c(65.0, 36.0, dte=30, delta=0.95),   # below long strike — dropped
    ]
    pairs = rank_pmcc(long_leg, shorts, price=100.0)
    assert len(pairs) == 1
    assert pairs[0].short_leg.strike == 110.0
    assert pairs[0].metrics.assignment_safe is True


# ── Contract-level (Greek) filters ────────────────────────────────────────────

def test_contract_filter_max_delta() -> None:
    f = ContractFilter(max_delta=0.35)
    assert f.passes(_c(105.0, 2.0, delta=0.30)) is True
    assert f.passes(_c(102.0, 3.0, delta=0.45)) is False
    # |delta| — put deltas are negative
    assert f.passes(_c(95.0, 2.0, option_type="put", delta=-0.30)) is True
    assert f.passes(_c(98.0, 3.0, option_type="put", delta=-0.45)) is False


def test_contract_filter_min_delta_for_pmcc_long_legs() -> None:
    f = ContractFilter(min_delta=0.75)
    assert f.passes(_c(70.0, 32.0, delta=0.85)) is True
    assert f.passes(_c(105.0, 2.0, delta=0.30)) is False


def test_contract_filter_none_delta_passes() -> None:
    # Missing data never silently excludes a contract (same policy as fundamentals)
    f = ContractFilter(min_delta=0.2, max_delta=0.4)
    assert f.passes(_c(105.0, 2.0, delta=None)) is True


def test_contract_filter_iv_rank_and_oi() -> None:
    f = ContractFilter(min_iv_rank=40.0, min_open_interest=500)
    assert f.passes(_c(105.0, 2.0, iv_rank=50.0, open_interest=1000)) is True
    assert f.passes(_c(105.0, 2.0, iv_rank=30.0, open_interest=1000)) is False
    assert f.passes(_c(105.0, 2.0, iv_rank=50.0, open_interest=100)) is False
    assert f.passes(_c(105.0, 2.0, iv_rank=None, open_interest=1000)) is True


def test_contract_filter_apply() -> None:
    f = ContractFilter(max_delta=0.35)
    contracts = [_c(105.0, 2.0, delta=0.30), _c(102.0, 3.0, delta=0.50)]
    assert [c.strike for c in f.apply(contracts)] == [105.0]
