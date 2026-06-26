from __future__ import annotations

from dataclasses import dataclass

from app.data.provider import OptionContract
from app.options.math import CoveredCallMetrics, covered_call_metrics


@dataclass
class RankedContract:
    contract: OptionContract
    metrics: CoveredCallMetrics


def rank_contracts(contracts: list[OptionContract], price: float) -> list[RankedContract]:
    """Compute metrics for each contract; sort by annualized_static descending."""
    ranked: list[RankedContract] = []
    for c in contracts:
        if c.premium <= 0:
            continue
        try:
            m = covered_call_metrics(price=price, strike=c.strike, premium=c.premium, dte=c.dte)
        except ValueError:
            continue
        ranked.append(RankedContract(contract=c, metrics=m))
    return sorted(ranked, key=lambda r: r.metrics.annualized_static, reverse=True)
