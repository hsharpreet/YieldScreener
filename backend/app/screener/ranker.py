from __future__ import annotations

from dataclasses import dataclass

from app.data.provider import OptionContract
from app.options.math import CoveredCallMetrics, covered_call_metrics


@dataclass
class RankedContract:
    contract: OptionContract
    metrics: CoveredCallMetrics


def _delta_fit(delta: float | None) -> float:
    """Return a multiplier [0.5, 1.0] that peaks at delta ≈ 0.30 (sweet spot for
    OTM covered-call income).

    No penalty within ±0.10 of the target (0.20–0.40 range).
    Linear penalty outside that band, floored at 0.5 so even extreme contracts
    can still win if their yield is high enough.
    """
    if delta is None:
        return 1.0  # no data → no penalty
    deviation = abs(delta - 0.30)
    penalty = max(0.0, deviation - 0.10) * 2.0
    return max(0.5, 1.0 - penalty)


def rank_contracts(
    contracts: list[OptionContract],
    price: float,
    otm_only: bool = True,
) -> list[RankedContract]:
    """Compute metrics for each contract; sort by a delta-adjusted score.

    Score = annualized_static × delta_fit(delta)
    This rewards high premium yield while preferring contracts near delta 0.30
    (the OTM sweet spot for income-focused covered calls).  Contracts with
    delta far from 0.30 (tiny premium or heavy assignment risk) score lower
    even if their raw yield is higher.

    otm_only=True excludes ITM calls whose premium is inflated by intrinsic
    value.  Pass False for the accordion detail view.
    """
    ranked: list[RankedContract] = []
    for c in contracts:
        if c.premium <= 0:
            continue
        if otm_only and c.strike < price:
            continue
        try:
            m = covered_call_metrics(price=price, strike=c.strike, premium=c.premium, dte=c.dte)
        except ValueError:
            continue
        ranked.append(RankedContract(contract=c, metrics=m))

    return sorted(
        ranked,
        key=lambda r: r.metrics.annualized_static * _delta_fit(r.contract.delta),
        reverse=True,
    )
