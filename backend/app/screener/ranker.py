from __future__ import annotations

from dataclasses import dataclass

from app.data.provider import OptionContract
from app.options.math import (
    CashSecuredPutMetrics,
    CoveredCallMetrics,
    PmccMetrics,
    cash_secured_put_metrics,
    covered_call_metrics,
    pmcc_metrics,
)


@dataclass
class RankedContract:
    contract: OptionContract
    metrics: CoveredCallMetrics | CashSecuredPutMetrics
    score: float = 0.0


@dataclass
class RankedPmcc:
    long_leg: OptionContract
    short_leg: OptionContract
    metrics: PmccMetrics
    score: float = 0.0


def _delta_fit(delta: float | None) -> float:
    """Return a multiplier [0.5, 1.0] that peaks at |delta| ≈ 0.30 (sweet spot
    for OTM premium selling — calls and puts alike; put deltas are negative).

    No penalty within ±0.10 of the target (0.20–0.40 range).
    Linear penalty outside that band, floored at 0.5 so even extreme contracts
    can still win if their yield is high enough.
    """
    if delta is None:
        return 1.0  # no data → no penalty
    deviation = abs(abs(delta) - 0.30)
    penalty = max(0.0, deviation - 0.10) * 2.0
    return max(0.5, 1.0 - penalty)


def is_itm(contract: OptionContract, price: float) -> bool:
    """ITM: calls below the stock price, puts above it."""
    if contract.option_type == "put":
        return contract.strike > price
    return contract.strike < price


def rank_contracts(
    contracts: list[OptionContract],
    price: float,
    otm_only: bool = True,
) -> list[RankedContract]:
    """Compute metrics for each contract; sort by a delta-adjusted score.

    Score = annualized_static × delta_fit(delta)
    This rewards high premium yield while preferring contracts near |delta|
    0.30 (the OTM sweet spot for income selling).  Works for calls (covered
    calls) and puts (cash-secured puts) — each contract's option_type picks
    the right math and the right ITM test.

    otm_only=True excludes ITM contracts whose premium is inflated by
    intrinsic value.  Pass False for the accordion detail view.
    """
    ranked: list[RankedContract] = []
    for c in contracts:
        if c.premium <= 0:
            continue
        if otm_only and is_itm(c, price):
            continue
        try:
            if c.option_type == "put":
                m: CoveredCallMetrics | CashSecuredPutMetrics = cash_secured_put_metrics(
                    price=price, strike=c.strike, premium=c.premium, dte=c.dte
                )
            else:
                m = covered_call_metrics(
                    price=price, strike=c.strike, premium=c.premium, dte=c.dte
                )
        except ValueError:
            continue
        score = m.annualized_static * _delta_fit(c.delta)
        ranked.append(RankedContract(contract=c, metrics=m, score=score))

    return sorted(ranked, key=lambda r: r.score, reverse=True)


def best_per_expiry(
    ranked: list[RankedContract],
    price: float,
) -> dict[str, RankedContract]:
    """Best OTM contract for each expiry, keyed by expiry date string.

    "Best" uses the same score as rank_contracts (annualized_static ×
    delta_fit).  ITM contracts never win a group: their premium is mostly
    intrinsic value, not income.  An expiry whose contracts are all ITM has
    no entry in the result.
    """
    winners: dict[str, RankedContract] = {}
    for r in ranked:
        if is_itm(r.contract, price):
            continue
        current = winners.get(r.contract.expiry)
        if current is None or r.score > current.score:
            winners[r.contract.expiry] = r
    return winners


# ── PMCC (poor man's covered call) ────────────────────────────────────────────

LONG_LEG_MIN_DELTA = 0.75      # deep ITM — the LEAPS behaves like stock
LONG_LEG_MAX_STRIKE_PCT = 0.80  # fallback when delta is missing: strike ≤ 80% of price


def select_long_leg(
    leaps: list[OptionContract],
    price: float,
) -> OptionContract | None:
    """Pick the long LEAPS call for a PMCC: deep ITM, minimal extrinsic value.

    Candidates need delta ≥ 0.75 (or, when the provider has no delta,
    strike ≤ 80% of the stock price as a deep-ITM proxy).  Among candidates
    we minimise extrinsic value per share (premium − intrinsic) — that's the
    true cost of renting the stock substitute.
    """
    candidates: list[OptionContract] = []
    for c in leaps:
        if c.option_type != "call" or c.premium <= 0 or c.strike >= price:
            continue
        if c.delta is not None:
            if c.delta >= LONG_LEG_MIN_DELTA:
                candidates.append(c)
        elif c.strike <= price * LONG_LEG_MAX_STRIKE_PCT:
            candidates.append(c)
    if not candidates:
        return None
    return min(candidates, key=lambda c: c.premium - (price - c.strike))


def rank_pmcc(
    long_leg: OptionContract,
    short_candidates: list[OptionContract],
    price: float,
) -> list[RankedPmcc]:
    """Pair one long LEAPS leg with every viable short call; rank pairs.

    Viable short: OTM call above the long strike whose strike width covers
    the net debit (assignment_safe) — a PMCC where assignment locks in a loss
    never wins.  Score = annualized_income × delta_fit(short delta).
    """
    ranked: list[RankedPmcc] = []
    for s in short_candidates:
        if s.option_type != "call" or s.premium <= 0:
            continue
        if s.strike < price or s.strike <= long_leg.strike:
            continue
        try:
            m = pmcc_metrics(
                price=price,
                long_strike=long_leg.strike,
                long_premium=long_leg.premium,
                short_strike=s.strike,
                short_premium=s.premium,
                short_dte=s.dte,
            )
        except ValueError:
            continue
        if not m.assignment_safe:
            continue
        score = m.annualized_income * _delta_fit(s.delta)
        ranked.append(RankedPmcc(long_leg=long_leg, short_leg=s, metrics=m, score=score))

    return sorted(ranked, key=lambda r: r.score, reverse=True)
