"""Endpoint tests for strategy=cash_secured_put and strategy=pmcc on
/api/screen and /api/contracts, plus the delta filter query params.

Uses a stub provider injected into the router module — no network, no DB.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

import app.routers.screener as screener_module
from app.data.provider import DataProvider, OptionContract, StockQuote
from app.main import app

client = TestClient(app)

PRICE = 100.0


def _contract(
    strike: float,
    premium: float,
    dte: int = 30,
    option_type: str = "call",
    delta: float | None = 0.30,
    expiry: str = "2026-08-07",
) -> OptionContract:
    return OptionContract(
        ticker="TST",
        strike=strike,
        expiry=expiry,
        dte=dte,
        premium=premium,
        bid=premium - 0.1,
        ask=premium + 0.1,
        volume=500,
        open_interest=2000,
        implied_volatility=0.25,
        earnings_within_dte=False,
        delta=delta,
        option_type=option_type,
    )


class StubProvider(DataProvider):
    def get_quote(self, ticker: str) -> StockQuote:
        return StockQuote(
            ticker=ticker, price=PRICE, name="Test Co",
            market_cap=10e9, avg_volume=1_000_000,
        )

    def get_call_options(
        self, ticker: str, min_dte: int = 21, max_dte: int = 45
    ) -> list[OptionContract]:
        return [
            _contract(105.0, 4.0, delta=0.35),
            _contract(110.0, 2.0, delta=0.25),
            _contract(120.0, 0.8, delta=0.10),
        ]

    def get_put_options(
        self, ticker: str, min_dte: int = 21, max_dte: int = 45
    ) -> list[OptionContract]:
        return [
            _contract(95.0, 2.0, option_type="put", delta=-0.30),
            _contract(90.0, 1.0, option_type="put", delta=-0.18),
            _contract(110.0, 11.0, option_type="put", delta=-0.85),  # ITM put
        ]

    def get_leaps_calls(
        self, ticker: str, min_dte: int = 180, max_dte: int = 730
    ) -> list[OptionContract]:
        return [
            _contract(70.0, 32.0, dte=365, delta=0.85, expiry="2027-06-18"),
            _contract(80.0, 24.0, dte=365, delta=0.78, expiry="2027-06-18"),
        ]


def _get(path: str):
    original = screener_module.provider
    screener_module.provider = StubProvider()
    try:
        res = client.get(path)
        assert res.status_code == 200, res.text
        return res.json()
    finally:
        screener_module.provider = original


# ── Cash-secured put ──────────────────────────────────────────────────────────

def test_screen_csp_returns_best_otm_put() -> None:
    rows = _get("/api/screen?tickers=TST&strategy=cash_secured_put")
    assert len(rows) == 1
    best = rows[0]["best_call"]
    assert best is not None
    assert best["option_type"] == "put"
    # The 110 ITM put never wins; 95-strike put has the best delta-adjusted yield
    assert best["strike"] == 95.0
    assert best["metrics"]["collateral"] == 9500.0
    assert best["metrics"]["breakeven"] == 93.0


def test_contracts_csp_flags() -> None:
    contracts = _get("/api/contracts/TST?strategy=cash_secured_put")
    assert len(contracts) == 3
    itm = next(c for c in contracts if c["strike"] == 110.0)
    assert itm["is_itm"] is True
    assert itm["best_for_expiry"] is False
    winners = [c for c in contracts if c["best_for_expiry"]]
    assert len(winners) == 1 and winners[0]["strike"] == 95.0
    recommended = [c for c in contracts if c["recommended"]]
    assert len(recommended) == 1


# ── PMCC ──────────────────────────────────────────────────────────────────────

def test_screen_pmcc_returns_pair() -> None:
    rows = _get("/api/screen?tickers=TST&strategy=pmcc")
    assert len(rows) == 1
    row = rows[0]
    long_leg, short_leg = row["long_call"], row["best_call"]
    assert long_leg is not None and short_leg is not None
    assert long_leg["leg"] == "long"
    assert short_leg["leg"] == "short"
    # Long leg: min extrinsic → 70-strike (extrinsic 2.0 vs 4.0)
    assert long_leg["strike"] == 70.0
    assert short_leg["strike"] > long_leg["strike"]
    m = short_leg["metrics"]
    assert m["capital_required"] == 3200.0
    assert m["assignment_safe"] is True
    # income yield = short premium / long premium
    assert abs(m["static_yield"] - short_leg["premium"] / 32.0) < 1e-9


def test_contracts_pmcc_long_leg_first() -> None:
    contracts = _get("/api/contracts/TST?strategy=pmcc")
    assert len(contracts) >= 2
    assert contracts[0]["leg"] == "long"
    shorts = [c for c in contracts[1:]]
    assert all(c["leg"] == "short" for c in shorts)
    assert sum(1 for c in shorts if c["recommended"]) == 1


# ── Delta filter params ───────────────────────────────────────────────────────

def test_screen_max_delta_filter() -> None:
    rows = _get("/api/screen?tickers=TST&strategy=covered_call&max_delta=0.2")
    best = rows[0]["best_call"]
    # Only the 120-strike (delta 0.10) survives max_delta=0.2
    assert best is not None and best["strike"] == 120.0


def test_screen_delta_filter_applies_to_puts_abs() -> None:
    rows = _get("/api/screen?tickers=TST&strategy=cash_secured_put&max_delta=0.2")
    best = rows[0]["best_call"]
    # |−0.18| passes; |−0.30| doesn't → 90-strike wins
    assert best is not None and best["strike"] == 90.0


def test_screen_min_delta_filter() -> None:
    rows = _get("/api/screen?tickers=TST&strategy=covered_call&min_delta=0.3")
    best = rows[0]["best_call"]
    assert best is not None and best["strike"] == 105.0


def test_screen_rejects_unknown_strategy() -> None:
    original = screener_module.provider
    screener_module.provider = StubProvider()
    try:
        res = client.get("/api/screen?tickers=TST&strategy=iron_condor")
        assert res.status_code == 422
    finally:
        screener_module.provider = original
