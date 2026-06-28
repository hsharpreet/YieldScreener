from __future__ import annotations

import datetime
import json
import threading
import time

import pandas as pd
import redis as redis_lib
import yfinance as yf

from app.core.config import settings
from app.data.provider import DataProvider, OptionContract, StockQuote

_redis: redis_lib.Redis | None = None

QUOTE_TTL = 1800      # 30-minute cache for fundamental quotes
CHAIN_TTL = 120       # 2-minute cache for option chains (enables live-ish accordion polling)

# ── Global Yahoo Finance rate limiter ─────────────────────────────────────────
# Only ONE thread may fire a yfinance HTTP request at a time, and we enforce a
# minimum 0.6-second gap between calls. This prevents the burst that corrupts
# the shared yfinance crumb and causes every request to fail with 429.
_yf_gate = threading.Semaphore(1)
_yf_last_call_lock = threading.Lock()
_yf_last_call: float = 0.0
_YF_MIN_INTERVAL = 0.6  # seconds between Yahoo Finance HTTP requests

# ── Per-ticker fetch locks ─────────────────────────────────────────────────────
# Prevents two threads from fetching the same ticker simultaneously.
# The second caller waits, then reads the result the first caller put in Redis.
_ticker_locks: dict[str, threading.Lock] = {}
_ticker_locks_guard = threading.Lock()


def _get_redis() -> redis_lib.Redis:
    global _redis
    if _redis is None:
        _redis = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _ticker_lock(key: str) -> threading.Lock:
    with _ticker_locks_guard:
        if key not in _ticker_locks:
            _ticker_locks[key] = threading.Lock()
        return _ticker_locks[key]


def _yf_call(fn, *args, **kwargs):
    """Execute a yfinance call through the rate limiter. Serialises all outbound
    Yahoo Finance HTTP requests to ≤1 per 0.6 s across the entire process."""
    global _yf_last_call
    with _yf_gate:
        with _yf_last_call_lock:
            gap = time.time() - _yf_last_call
            if gap < _YF_MIN_INTERVAL:
                time.sleep(_YF_MIN_INTERVAL - gap)
            _yf_last_call = time.time()
        return fn(*args, **kwargs)


def _row_float(row: pd.Series, key: str) -> float | None:
    val = row.get(key)
    return float(val) if val is not None else None


class YFinanceProvider(DataProvider):

    def get_quote(self, ticker: str) -> StockQuote:
        """Return fundamental quote, reading from Redis cache first.

        Uses a per-ticker lock so only one thread fetches a cold ticker;
        the second caller waits then reads the cache the first caller populated.
        """
        cached = self._read_quote_cache(ticker)
        if cached:
            return cached

        with _ticker_lock(f"quote:{ticker}"):
            # Double-check: another thread may have populated cache while we waited.
            cached = self._read_quote_cache(ticker)
            if cached:
                return cached
            return self._fetch_and_cache_quote(ticker)

    def _read_quote_cache(self, ticker: str) -> StockQuote | None:
        try:
            cached = _get_redis().get(f"quote:{ticker}")
            if cached:
                return StockQuote(**json.loads(cached))
        except Exception:
            pass
        return None

    def _fetch_and_cache_quote(self, ticker: str) -> StockQuote:
        quote = self._fetch_quote(ticker)
        try:
            _get_redis().setex(f"quote:{ticker}", QUOTE_TTL, json.dumps(quote.__dict__))
        except Exception:
            pass
        return quote

    def _fetch_quote(self, ticker: str) -> StockQuote:
        """One attempt (with one 429 retry) to fetch fundamentals from yfinance."""
        for attempt in range(2):
            try:
                info = _yf_call(lambda: yf.Ticker(ticker).info)
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
                if "429" in str(exc) and attempt == 0:
                    time.sleep(2)
                    continue
                raise

        raise RuntimeError(f"Failed to fetch quote for {ticker}")

    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        """Return call contracts, reading from Redis cache first.

        Short TTL (2 min) so the accordion detail view gets reasonably fresh
        data when the frontend polls this endpoint every 30 seconds.
        """
        cache_key = f"chain:{ticker}:{min_dte}:{max_dte}"
        cached = self._read_chain_cache(cache_key)
        if cached is not None:
            return cached

        with _ticker_lock(cache_key):
            cached = self._read_chain_cache(cache_key)
            if cached is not None:
                return cached
            return self._fetch_and_cache_chain(ticker, min_dte, max_dte, cache_key)

    def _read_chain_cache(self, cache_key: str) -> list[OptionContract] | None:
        try:
            raw = _get_redis().get(cache_key)
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass
        return None

    def _fetch_and_cache_chain(
        self,
        ticker: str,
        min_dte: int,
        max_dte: int,
        cache_key: str,
    ) -> list[OptionContract]:
        contracts = self._fetch_call_options(ticker, min_dte, max_dte)
        try:
            _get_redis().setex(cache_key, CHAIN_TTL, json.dumps([c.__dict__ for c in contracts]))
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
            cal = _yf_call(lambda: t.calendar)
            if cal is not None and "Earnings Date" in cal:
                ed = cal["Earnings Date"]
                if hasattr(ed, "__iter__"):
                    ed = list(ed)[0]
                earnings_date = pd.Timestamp(ed).date() if hasattr(ed, "date") else None
        except Exception:
            earnings_date = None

        # Filter to DTE window before fetching chains — avoids calls for out-of-range expiries.
        try:
            all_options = _yf_call(lambda: t.options)
        except Exception:
            return []

        valid_expiries: list[tuple[str, int]] = []
        for exp_str in all_options:
            exp = datetime.date.fromisoformat(exp_str)
            dte = (exp - today).days
            if min_dte <= dte <= max_dte:
                valid_expiries.append((exp_str, dte))

        contracts: list[OptionContract] = []
        for exp_str, dte in valid_expiries:
            try:
                chain = _yf_call(lambda: t.option_chain(exp_str).calls)
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
