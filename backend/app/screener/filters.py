from __future__ import annotations

from dataclasses import dataclass

from app.data.provider import OptionContract, StockQuote


@dataclass
class FundamentalsFilter:
    # General
    min_market_cap: float | None = None
    sector_filter: list[str] | None = None
    max_analyst_rating: float | None = None

    # Valuation
    max_pe: float | None = None
    max_forward_pe: float | None = None
    max_peg: float | None = None
    max_price_to_book: float | None = None
    max_price_to_sales: float | None = None
    max_ev_to_ebitda: float | None = None
    min_dividend_yield: float | None = None   # e.g. 0.02 = 2%

    # Profitability
    min_gross_margin: float | None = None
    min_operating_margin: float | None = None
    min_net_margin: float | None = None
    min_roe: float | None = None
    min_roa: float | None = None

    # Financial health
    max_debt_to_equity: float | None = None
    min_current_ratio: float | None = None

    # Risk / trading
    max_beta: float | None = None
    max_short_float: float | None = None      # e.g. 0.10 = 10%

    # Legacy average-volume floor (internal, not exposed as query param yet)
    min_avg_volume: int = 500_000

    def passes(self, quote: StockQuote) -> bool:
        # General
        if self.min_market_cap is not None and quote.market_cap is not None:
            if quote.market_cap < self.min_market_cap:
                return False
        if self.sector_filter is not None and quote.sector is not None:
            normalized = [s.lower() for s in self.sector_filter]
            if quote.sector.lower() not in normalized:
                return False
        if self.max_analyst_rating is not None and quote.analyst_rating is not None:
            if quote.analyst_rating > self.max_analyst_rating:
                return False

        # Valuation
        if self.max_pe is not None and quote.pe_ratio is not None:
            if quote.pe_ratio > self.max_pe:
                return False
        if self.max_forward_pe is not None and quote.forward_pe is not None:
            if quote.forward_pe > self.max_forward_pe:
                return False
        if self.max_peg is not None and quote.peg_ratio is not None:
            if quote.peg_ratio > self.max_peg:
                return False
        if self.max_price_to_book is not None and quote.price_to_book is not None:
            if quote.price_to_book > self.max_price_to_book:
                return False
        if self.max_price_to_sales is not None and quote.price_to_sales is not None:
            if quote.price_to_sales > self.max_price_to_sales:
                return False
        if self.max_ev_to_ebitda is not None and quote.ev_to_ebitda is not None:
            if quote.ev_to_ebitda > self.max_ev_to_ebitda:
                return False
        if self.min_dividend_yield is not None and quote.dividend_yield is not None:
            if quote.dividend_yield < self.min_dividend_yield:
                return False

        # Profitability
        if self.min_gross_margin is not None and quote.gross_margin is not None:
            if quote.gross_margin < self.min_gross_margin:
                return False
        if self.min_operating_margin is not None and quote.operating_margin is not None:
            if quote.operating_margin < self.min_operating_margin:
                return False
        if self.min_net_margin is not None and quote.net_margin is not None:
            if quote.net_margin < self.min_net_margin:
                return False
        if self.min_roe is not None and quote.roe is not None:
            if quote.roe < self.min_roe:
                return False
        if self.min_roa is not None and quote.roa is not None:
            if quote.roa < self.min_roa:
                return False

        # Financial health
        if self.max_debt_to_equity is not None and quote.debt_to_equity is not None:
            if quote.debt_to_equity > self.max_debt_to_equity:
                return False
        if self.min_current_ratio is not None and quote.current_ratio is not None:
            if quote.current_ratio < self.min_current_ratio:
                return False

        # Risk / trading
        if self.max_beta is not None and quote.beta is not None:
            if quote.beta > self.max_beta:
                return False
        if self.max_short_float is not None and quote.short_float is not None:
            if quote.short_float > self.max_short_float:
                return False

        # Avg volume floor
        if self.min_avg_volume > 0 and quote.avg_volume is not None:
            if quote.avg_volume < self.min_avg_volume:
                return False

        return True


def filter_illiquid(contracts: list[OptionContract]) -> list[OptionContract]:
    """Remove zero-bid, wide-spread contracts.

    Volume is intentionally not checked: it resets to 0 at market close and
    would filter everything during off-hours. Open interest (which persists
    across sessions) is the correct liquidity proxy.
    """
    result = []
    for c in contracts:
        if c.bid <= 0 or c.ask <= 0:
            continue
        spread_pct = (c.ask - c.bid) / c.ask
        if spread_pct > 0.15:
            continue
        if c.open_interest < 100:
            continue
        result.append(c)
    return result
