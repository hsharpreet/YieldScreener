from __future__ import annotations

from dataclasses import dataclass

from app.data.provider import OptionContract, StockQuote


@dataclass
class FundamentalsFilter:
    min_market_cap: float = 5_000_000_000  # $5 B
    max_pe: float = 50.0
    min_avg_volume: int = 500_000

    def passes(self, quote: StockQuote) -> bool:
        if quote.market_cap is not None and quote.market_cap < self.min_market_cap:
            return False
        if quote.pe_ratio is not None and quote.pe_ratio > self.max_pe:
            return False
        if quote.avg_volume is not None and quote.avg_volume < self.min_avg_volume:
            return False
        return True


def filter_illiquid(contracts: list[OptionContract]) -> list[OptionContract]:
    """Remove zero-bid, wide-spread, and thinly-traded contracts (CC-8)."""
    result = []
    for c in contracts:
        if c.bid <= 0 or c.ask <= 0:
            continue
        spread_pct = (c.ask - c.bid) / c.ask
        if spread_pct > 0.15:
            continue
        if c.volume < 10:
            continue
        if c.open_interest < 100:
            continue
        result.append(c)
    return result
