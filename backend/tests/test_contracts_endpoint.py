"""Endpoint tests for /api/contracts/{ticker} ranking flags.

Uses a stub provider injected into the router module — no network, no DB.
Verifies the accordion contract: every expiry has exactly one best_for_expiry
OTM winner, exactly one contract overall is recommended, and ITM contracts
are flagged but never win.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

import app.routers.screener as screener_module
from app.data.provider import DataProvider, OptionContract, StockQuote
from app.main import app

client = TestClient(app)

PRICE = 100.0


def _contract(strike: float, expiry: str, dte: int, premium: float) -> OptionContract:
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
        delta=0.30,
    )


class StubProvider(DataProvider):
    def get_quote(self, ticker: str) -> StockQuote:
        return StockQuote(ticker=ticker, price=PRICE, name="Test Co")

    def get_call_options(
        self, ticker: str, min_dte: int = 21, max_dte: int = 45
    ) -> list[OptionContract]:
        return [
            # Feb expiry: one ITM, two OTM (105 has the higher yield)
            _contract(90.0, "2024-02-16", 14, 12.0),
            _contract(102.0, "2024-02-16", 14, 1.0),
            _contract(105.0, "2024-02-16", 14, 4.0),
            # Mar expiry: single OTM
            _contract(110.0, "2024-03-15", 42, 5.0),
        ]


def _with_stub_provider() -> list[dict]:
    original = screener_module.provider
    screener_module.provider = StubProvider()
    try:
        res = client.get("/api/contracts/TST")
        assert res.status_code == 200
        return res.json()
    finally:
        screener_module.provider = original


def test_contracts_flags() -> None:
    contracts = _with_stub_provider()
    assert len(contracts) == 4

    by_key = {(c["expiry"], c["strike"]): c for c in contracts}

    # Exactly one best OTM per expiry
    feb_winners = [c for c in contracts if c["expiry"] == "2024-02-16" and c["best_for_expiry"]]
    mar_winners = [c for c in contracts if c["expiry"] == "2024-03-15" and c["best_for_expiry"]]
    assert len(feb_winners) == 1
    assert len(mar_winners) == 1
    assert feb_winners[0]["strike"] == 105.0
    assert mar_winners[0]["strike"] == 110.0

    # Exactly one recommended overall, and it is one of the expiry winners
    recommended = [c for c in contracts if c["recommended"]]
    assert len(recommended) == 1
    assert recommended[0]["best_for_expiry"] is True

    # ITM contract flagged, never a winner despite its big (intrinsic) premium
    itm = by_key[("2024-02-16", 90.0)]
    assert itm["is_itm"] is True
    assert itm["best_for_expiry"] is False
    assert itm["recommended"] is False

    # Score present and consistent with ranking order
    scores = [c["score"] for c in contracts]
    assert scores == sorted(scores, reverse=True)


def test_contracts_rejects_unknown_strategy() -> None:
    original = screener_module.provider
    screener_module.provider = StubProvider()
    try:
        res = client.get("/api/contracts/TST?strategy=iron_condor")
        assert res.status_code == 422
    finally:
        screener_module.provider = original
