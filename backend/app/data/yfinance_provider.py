from app.data.provider import DataProvider, OptionContract, StockQuote


class YFinanceProvider(DataProvider):
    def get_quote(self, ticker: str) -> StockQuote:
        raise NotImplementedError("yfinance provider not yet implemented")

    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        raise NotImplementedError("yfinance provider not yet implemented")
