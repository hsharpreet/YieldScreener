from __future__ import annotations

import datetime
import json
import time

import pandas as pd
import redis as redis_lib
import yfinance as yf

from app.core.config import settings
from app.data.provider import DataProvider, OptionContract, StockQuote

_redis: redis_lib.Redis | None = None

QUOTE_TTL = 1800      # 30-minute cache for fundamental quotes
CHAIN_TTL = 900       # 15-minute cache for option chains
_INTER_EXPIRY_DELAY = 0.4   # seconds between option_chain() calls for each expiry


def _get_redis() -> redis_lib.Redis:
    global _redis
    if _redis is None:
        _redis = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _row_float(row: pd.Series, key: str) -> float | None:
    val = row.get(key)
    return float(val) if val is not None else None


class YFinanceProvider(DataProvider):

    def get_quote(self, ticker: str) -> StockQuote:
        """Return fundamental quote, reading from Redis cache when available."""
        cache_key = f"quote:{ticker}"
        try:
            r = _get_redis()
            cached = r.get(cache_key)
            if cached:
                return StockQuote(**json.loads(cached))
        except Exception:
            pass

        quote = self._fetch_quote(ticker)

        try:
            r = _get_redis()
            r.setex(cache_key, QUOTE_TTL, json.dumps(quote.__dict__))
        except Exception:
            pass

        return quote

    def _fetch_quote(self, ticker: str) -> StockQuote:
        """Fetch fundamental quote from yfinance with retry on 429."""
        for attempt in range(3):
            try:
                info = yf.Ticker(ticker).info
                price = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0

                def _float(key: str) -> float | None:
                    val = info.get(key)
                    return float(val) if val is not None else None

                return StockQuote(
                    ticker=ticker,
                    price=float(price),
                    name=info.get("shortName") or ticker,
                    market_cap=info.get("marketCap"),
                    pe_ratio=_float("trailingPE"),
                    forward_pe=_float("forwardPE"),
                    dividend_yield=_float("dividendYield"),
                    avg_volume=info.get("averageVolume"),
                    sector=info.get("sector"),
                    beta=_float("beta"),
                    peg_ratio=_float("pegRatio"),
                    roe=_float("returnOnEquity"),
                    eps_growth=_float("earningsGrowth"),
                    revenue_growth=_float("revenueGrowth"),
                    analyst_rating=_float("recommendationMean"),
                )
            except Exception as exc:
                if "429" in str(exc) and attempt < 2:
                    time.sleep(2 ** (attempt + 1))  # 2s, 4s backoff
                    continue
                raise

        raise RuntimeError(f"Failed to fetch quote for {ticker} after retries")

    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        """Return call contracts, reading from Redis cache when available."""
        cache_key = f"option_chain:{ticker}:{min_dte}:{max_dte}"
        try:
            r = _get_redis()
            cached = r.get(cache_key)
            if cached:
                raw_list: list[dict] = json.loads(cached)
                return [OptionContract(**d) for d in raw_list]
        except Exception:
            pass

        contracts = self._fetch_call_options(ticker, min_dte, max_dte)

        try:
            r = _get_redis()
            r.setex(cache_key, CHAIN_TTL, json.dumps([c.__dict__ for c in contracts]))
        except Exception:
            pass

        return contracts

    def _fetch_call_options(
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

        # Filter expiry dates to those within the DTE window before fetching chains.
        # This avoids unnecessary HTTP calls for out-of-range expiries.
        valid_expiries: list[tuple[str, int]] = []
        for exp_str in t.options:
            exp = datetime.date.fromisoformat(exp_str)
            dte = (exp - today).days
            if min_dte <= dte <= max_dte:
                valid_expiries.append((exp_str, dte))

        contracts: list[OptionContract] = []
        for idx, (exp_str, dte) in enumerate(valid_expiries):
            # Pace calls to Yahoo Finance — never fire them back-to-back.
            if idx > 0:
                time.sleep(_INTER_EXPIRY_DELAY)

            try:
                chain = t.option_chain(exp_str).calls
            except Exception:
                continue

            iv_values: list[float] = [
                float(row.get("impliedVolatility"))
                for _, row in chain.iterrows()
                if row.get("impliedVolatility") is not None
            ]
            iv_min = min(iv_values) if iv_values else None
            iv_max = max(iv_values) if iv_values else None
            iv_range = (iv_max - iv_min) if (iv_min is not None and iv_max is not None) else None

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

                current_iv_raw = row.get("impliedVolatility")
                current_iv = float(current_iv_raw) if current_iv_raw is not None else None
                if (
                    iv_range is not None
                    and iv_range > 0
                    and current_iv is not None
                    and iv_min is not None
                ):
                    iv_rank: float | None = (current_iv - iv_min) / iv_range * 100
                else:
                    iv_rank = None

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
                        delta=_row_float(row, "delta"),
                        gamma=_row_float(row, "gamma"),
                        theta=_row_float(row, "theta"),
                        vega=_row_float(row, "vega"),
                        iv_rank=iv_rank,
                    )
                )
        return contracts
