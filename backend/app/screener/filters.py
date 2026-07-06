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

    # Growth
    min_eps_growth: float | None = None       # e.g. 0.10 = 10% YoY
    min_quick_ratio: float | None = None

    # Technicals
    min_rsi: float | None = None              # 0–100
    max_rsi: float | None = None
    above_sma_50: bool | None = None          # True = price above, False = below
    above_sma_200: bool | None = None
    min_52w_position: float | None = None     # 0–1: (price−low)/(high−low)
    max_52w_position: float | None = None

    # Average-volume floor (also exposed as a query param)
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

        # Growth
        if self.min_eps_growth is not None and quote.eps_growth is not None:
            if quote.eps_growth < self.min_eps_growth:
                return False
        if self.min_quick_ratio is not None and quote.quick_ratio is not None:
            if quote.quick_ratio < self.min_quick_ratio:
                return False

        # Technicals
        if self.min_rsi is not None and quote.rsi_14 is not None:
            if quote.rsi_14 < self.min_rsi:
                return False
        if self.max_rsi is not None and quote.rsi_14 is not None:
            if quote.rsi_14 > self.max_rsi:
                return False
        if self.above_sma_50 is not None and quote.sma_50 is not None and quote.price > 0:
            if (quote.price >= quote.sma_50) != self.above_sma_50:
                return False
        if self.above_sma_200 is not None and quote.sma_200 is not None and quote.price > 0:
            if (quote.price >= quote.sma_200) != self.above_sma_200:
                return False
        position = _52w_position(quote)
        if position is not None:
            if self.min_52w_position is not None and position < self.min_52w_position:
                return False
            if self.max_52w_position is not None and position > self.max_52w_position:
                return False

        # Avg volume floor
        if self.min_avg_volume > 0 and quote.avg_volume is not None:
            if quote.avg_volume < self.min_avg_volume:
                return False

        return True


def _52w_position(quote: StockQuote) -> float | None:
    """Where the price sits in its 52-week range: 0 = at the low, 1 = at the high."""
    high, low = quote.fifty_two_week_high, quote.fifty_two_week_low
    if high is None or low is None or high <= low or quote.price <= 0:
        return None
    return (quote.price - low) / (high - low)


@dataclass
class ContractFilter:
    """Per-contract filters applied before ranking (delta is |delta| so the
    same bounds work for calls and puts)."""
    min_delta: float | None = None
    max_delta: float | None = None
    min_iv_rank: float | None = None
    min_open_interest: int | None = None

    def passes(self, contract: OptionContract) -> bool:
        if self.min_delta is not None and contract.delta is not None:
            if abs(contract.delta) < self.min_delta:
                return False
        if self.max_delta is not None and contract.delta is not None:
            if abs(contract.delta) > self.max_delta:
                return False
        if self.min_iv_rank is not None and contract.iv_rank is not None:
            if contract.iv_rank < self.min_iv_rank:
                return False
        if self.min_open_interest is not None:
            if contract.open_interest < self.min_open_interest:
                return False
        return True

    def apply(self, contracts: list[OptionContract]) -> list[OptionContract]:
        return [c for c in contracts if self.passes(c)]


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
        if spread_pct > 0.40:
            continue
        if c.open_interest < 50:
            continue
        result.append(c)
    return result
