from __future__ import annotations

from dataclasses import dataclass

from app.data.provider import OptionContract, StockQuote


@dataclass
class FundamentalsFilter:
    min_market_cap: float = 5_000_000_000  # $5 B
    max_pe: float = 50.0
    min_avg_volume: int = 500_000
    max_beta: float | None = None           # exclude if beta > max_beta
    min_roe: float | None = None            # exclude if roe < min_roe (e.g. 0.10 = 10%)
    max_peg: float | None = None            # exclude if peg_ratio > max_peg
    # if set, only include matching sectors (case-insensitive)
    sector_filter: list[str] | None = None
    # exclude if analyst_rating > max (lower = better; 2.5 = Buy)
    max_analyst_rating: float | None = None

    def passes(self, quote: StockQuote) -> bool:
        if quote.market_cap is not None and quote.market_cap < self.min_market_cap:
            return False
        if quote.pe_ratio is not None and quote.pe_ratio > self.max_pe:
            return False
        if quote.avg_volume is not None and quote.avg_volume < self.min_avg_volume:
            return False
        if self.max_beta is not None and quote.beta is not None and quote.beta > self.max_beta:
            return False
        if self.min_roe is not None and quote.roe is not None and quote.roe < self.min_roe:
            return False
        if (
            self.max_peg is not None
            and quote.peg_ratio is not None
            and quote.peg_ratio > self.max_peg
        ):
            return False
        if self.sector_filter is not None and quote.sector is not None:
            normalized = [s.lower() for s in self.sector_filter]
            if quote.sector.lower() not in normalized:
                return False
        if (
            self.max_analyst_rating is not None
            and quote.analyst_rating is not None
            and quote.analyst_rating > self.max_analyst_rating
        ):
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
