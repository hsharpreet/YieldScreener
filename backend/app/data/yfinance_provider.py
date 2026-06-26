from __future__ import annotations

import datetime

import pandas as pd
import yfinance as yf

from app.data.provider import DataProvider, OptionContract, StockQuote


class YFinanceProvider(DataProvider):
    def get_quote(self, ticker: str) -> StockQuote:
        info = yf.Ticker(ticker).info
        price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
        return StockQuote(
            ticker=ticker,
            price=float(price),
            name=info.get("shortName") or ticker,
            market_cap=info.get("marketCap"),
            pe_ratio=info.get("trailingPE"),
            forward_pe=info.get("forwardPE"),
            dividend_yield=info.get("dividendYield"),
            avg_volume=info.get("averageVolume"),
            sector=info.get("sector"),
            beta=info.get("beta"),
        )

    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        t = yf.Ticker(ticker)
        today = datetime.date.today()

        earnings_date: datetime.date | None = None
        try:
            cal = t.calendar
            if cal is not None and "Earnings Date" in cal:
                ed = cal["Earnings Date"]
                if hasattr(ed, "__iter__"):
                    ed = list(ed)[0]
                earnings_date = pd.Timestamp(ed).date() if hasattr(ed, "date") else None
        except Exception:
            earnings_date = None

        contracts: list[OptionContract] = []
        for exp_str in t.options:
            exp = datetime.date.fromisoformat(exp_str)
            dte = (exp - today).days
            if not (min_dte <= dte <= max_dte):
                continue
            try:
                chain = t.option_chain(exp_str).calls
            except Exception:
                continue
            for _, row in chain.iterrows():
                bid = float(row.get("bid", 0) or 0)
                ask = float(row.get("ask", 0) or 0)
                if bid <= 0 or ask <= 0:
                    continue
                premium = (bid + ask) / 2
                earnings_flag = (
                    earnings_date is not None
                    and today < earnings_date <= (today + datetime.timedelta(days=dte))
                )
                contracts.append(
                    OptionContract(
                        ticker=ticker,
                        strike=float(row["strike"]),
                        expiry=exp_str,
                        dte=dte,
                        premium=premium,
                        bid=bid,
                        ask=ask,
                        volume=int(row.get("volume") or 0),
                        open_interest=int(row.get("openInterest") or 0),
                        implied_volatility=float(row.get("impliedVolatility") or 0),
                        earnings_within_dte=earnings_flag,
                    )
                )
        return contracts
