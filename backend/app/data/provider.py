from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class StockQuote:
    ticker: str
    price: float
    name: str
    market_cap: float | None = None
    pe_ratio: float | None = None
    forward_pe: float | None = None
    dividend_yield: float | None = None
    avg_volume: int | None = None
    sector: str | None = None
    beta: float | None = None
    peg_ratio: float | None = None
    roe: float | None = None          # returnOnEquity from yfinance
    eps_growth: float | None = None   # earningsGrowth from yfinance
    revenue_growth: float | None = None  # revenueGrowth
    analyst_rating: float | None = None  # recommendationMean (1=Strong Buy, 5=Sell)


@dataclass
class OptionContract:
    ticker: str
    strike: float
    expiry: str
    dte: int
    premium: float
    bid: float
    ask: float
    volume: int
    open_interest: int
    implied_volatility: float
    earnings_within_dte: bool
    delta: float | None = None
    gamma: float | None = None
    theta: float | None = None
    vega: float | None = None
    iv_rank: float | None = None  # 0-100, None if not computable


class DataProvider(ABC):
    @abstractmethod
    def get_quote(self, ticker: str) -> StockQuote: ...

    @abstractmethod
    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]: ...
