from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class StockQuote:
    ticker: str
    price: float
    name: str


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
