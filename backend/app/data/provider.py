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
