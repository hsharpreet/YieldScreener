"""yfinance data provider.

Architecture
────────────
• Prices   — `yf.download(all_tickers, …)` in ONE HTTP call → Redis (PRICE_TTL)
• Fundamentals — `yf.Ticker(t).info` per ticker, cached 24 h (rarely changes)
• Option chains — `yf.Ticker(t).option_chain(exp)` per ticker, cached CHAIN_TTL

The background scheduler (scheduler.py) is the ONLY thing that calls Yahoo Finance.
Screener endpoint reads exclusively from Redis. If Redis is cold the screener
returns an empty list with a "data_loading" flag — the scheduler populates it.

Yahoo Finance is rate-limited to ≤1 request/0.6 s via _yf_semaphore regardless
of how many threads are running. Per-ticker locks prevent duplicate concurrent
fetches of the same symbol.
"""
from __future__ import annotations

import datetime
import json
import threading
import time
from typing import Optional

import pandas as pd
import redis as redis_lib
import requests
import yfinance as yf

from app.core.config import settings
from app.data.provider import DataProvider, OptionContract, StockQuote

# ── Redis ──────────────────────────────────────────────────────────────────────
_redis: redis_lib.Redis | None = None

PRICE_TTL = settings.YF_REFRESH_INTERVAL + 120   # expire slightly after next refresh
FUNDAMENTALS_TTL = 86_400                          # 24 h — quarterly data
CHAIN_TTL = settings.YF_REFRESH_INTERVAL + 120    # expire slightly after next refresh

# ── Shared requests session with browser User-Agent ───────────────────────────
_yf_session = requests.Session()
_yf_session.headers.update({"User-Agent": settings.YF_USER_AGENT})

# ── Global rate-limiter ────────────────────────────────────────────────────────
# Ensures the entire process fires at most one yfinance HTTP call per 0.6 s.
_yf_semaphore = threading.Semaphore(1)
_yf_last_call_lock = threading.Lock()
_yf_last_call: float = 0.0
_YF_MIN_INTERVAL = 0.6  # seconds between outbound Yahoo Finance requests

# ── Per-ticker locks (double-check pattern) ───────────────────────────────────
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
    """Serialise all Yahoo Finance HTTP calls: max 1 per 0.6 s, globally."""
    global _yf_last_call
    with _yf_semaphore:
        with _yf_last_call_lock:
            gap = time.time() - _yf_last_call
            if gap < _YF_MIN_INTERVAL:
                time.sleep(_YF_MIN_INTERVAL - gap)
            _yf_last_call = time.time()
        return fn(*args, **kwargs)


def _yf_retry(fn, *args, **kwargs):
    """Call fn() through the rate limiter with retry/backoff on 429."""
    for attempt in range(settings.YF_MAX_RETRIES):
        try:
            return _yf_call(fn, *args, **kwargs)
        except Exception as exc:
            if "429" in str(exc) and attempt < settings.YF_MAX_RETRIES - 1:
                time.sleep(settings.YF_RETRY_SLEEP * (2 ** attempt))
                continue
            raise
    raise RuntimeError("Exceeded max retries")


# ─────────────────────────────────────────────────────────────────────────────
# Batch price refresh  (called by scheduler — ONE HTTP call for all tickers)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_batch_prices(tickers: list[str]) -> dict[str, float]:
    """Download latest prices for all tickers in a single yf.download() call.

    Returns {ticker: price}. Stores each price in Redis under 'price:{ticker}'.
    """
    joined = " ".join(tickers)

    def _download():
        return yf.download(
            joined,
            period="1d",
            interval="5m",
            auto_adjust=True,
            progress=False,
            session=_yf_session,
        )

    try:
        data = _yf_retry(_download)
    except Exception:
        return {}

    if data is None or data.empty:
        return {}

    prices: dict[str, float] = {}

    # yf.download returns different column structures for 1 vs many tickers.
    if isinstance(data.columns, pd.MultiIndex):
        # Multiple tickers → MultiIndex (field, ticker)
        close = data["Close"]
        latest = close.iloc[-1]
        for ticker in tickers:
            if ticker in latest.index and pd.notna(latest[ticker]):
                prices[ticker] = float(latest[ticker])
    else:
        # Single ticker → flat columns
        if "Close" in data.columns and not data["Close"].empty:
            prices[tickers[0]] = float(data["Close"].iloc[-1])

    r = _get_redis()
    for ticker, price in prices.items():
        try:
            r.setex(f"price:{ticker}", PRICE_TTL, str(price))
        except Exception:
            pass

    return prices


# ─────────────────────────────────────────────────────────────────────────────
# Fundamentals refresh  (called by scheduler — one call per ticker, 24 h cache)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_fundamentals(ticker: str) -> Optional[StockQuote]:
    """Fetch fundamental data for ticker, store in Redis, return StockQuote."""
    with _ticker_lock(f"fund:{ticker}"):
        # Don't re-fetch if already cached.
        try:
            cached = _get_redis().get(f"fundamentals:{ticker}")
            if cached:
                return StockQuote(**json.loads(cached))
        except Exception:
            pass

        try:
            info = _yf_retry(lambda: yf.Ticker(ticker, session=_yf_session).info)
        except Exception:
            return None

        def _f(key: str) -> float | None:
            val = info.get(key)
            return float(val) if val is not None else None

        # Price comes from the batch download, not from .info.
        # We store a placeholder price of 0; the screener fills in the real price.
        quote = StockQuote(
            ticker=ticker,
            price=0.0,
            name=info.get("shortName") or ticker,
            market_cap=info.get("marketCap"),
            pe_ratio=_f("trailingPE"),
            forward_pe=_f("forwardPE"),
            dividend_yield=_f("dividendYield"),
            avg_volume=info.get("averageVolume"),
            sector=info.get("sector"),
            beta=_f("beta"),
            peg_ratio=_f("pegRatio"),
            roe=_f("returnOnEquity"),
            eps_growth=_f("earningsGrowth"),
            revenue_growth=_f("revenueGrowth"),
            analyst_rating=_f("recommendationMean"),
        )

        try:
            _get_redis().setex(
                f"fundamentals:{ticker}", FUNDAMENTALS_TTL, json.dumps(quote.__dict__)
            )
        except Exception:
            pass

        return quote


# ─────────────────────────────────────────────────────────────────────────────
# Option chain refresh  (called by scheduler — individual per ticker)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_option_chain(ticker: str, min_dte: int = 21, max_dte: int = 45) -> list[OptionContract]:
    """Fetch option chain for one ticker, store in Redis, return contracts."""
    cache_key = f"chain:{ticker}:{min_dte}:{max_dte}"

    with _ticker_lock(cache_key):
        # Skip if recently refreshed.
        try:
            raw = _get_redis().get(cache_key)
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass

        contracts = _fetch_chain(ticker, min_dte, max_dte)

        try:
            _get_redis().setex(cache_key, CHAIN_TTL, json.dumps([c.__dict__ for c in contracts]))
        except Exception:
            pass

        return contracts


def _fetch_chain(ticker: str, min_dte: int, max_dte: int) -> list[OptionContract]:
    t = yf.Ticker(ticker, session=_yf_session)
    today = datetime.date.today()

    earnings_date: datetime.date | None = None
    try:
        cal = _yf_retry(lambda: t.calendar)
        if cal is not None and "Earnings Date" in cal:
            ed = cal["Earnings Date"]
            if hasattr(ed, "__iter__"):
                ed = list(ed)[0]
            earnings_date = pd.Timestamp(ed).date() if hasattr(ed, "date") else None
    except Exception:
        earnings_date = None

    try:
        all_options = _yf_retry(lambda: t.options)
    except Exception:
        return []

    valid_expiries = [
        (exp_str, (datetime.date.fromisoformat(exp_str) - today).days)
        for exp_str in all_options
        if min_dte <= (datetime.date.fromisoformat(exp_str) - today).days <= max_dte
    ]

    contracts: list[OptionContract] = []
    for exp_str, dte in valid_expiries:
        try:
            chain = _yf_retry(lambda: t.option_chain(exp_str).calls)
        except Exception:
            continue

        iv_vals = [
            float(r.get("impliedVolatility"))
            for _, r in chain.iterrows()
            if r.get("impliedVolatility") is not None
        ]
        iv_min = min(iv_vals) if iv_vals else None
        iv_max = max(iv_vals) if iv_vals else None
        iv_range = (iv_max - iv_min) if iv_min is not None and iv_max is not None else None

        for _, row in chain.iterrows():
            bid = float(row.get("bid", 0) or 0)
            ask = float(row.get("ask", 0) or 0)
            if bid <= 0 or ask <= 0:
                continue
            premium = (bid + ask) / 2
            earnings_flag = (
                earnings_date is not None
                and today < earnings_date <= today + datetime.timedelta(days=dte)
            )
            cur_iv = row.get("impliedVolatility")
            cur_iv_f = float(cur_iv) if cur_iv is not None else None
            iv_rank = (
                (cur_iv_f - iv_min) / iv_range * 100
                if iv_range and iv_range > 0 and cur_iv_f is not None and iv_min is not None
                else None
            )

            def _rf(key: str) -> float | None:
                v = row.get(key)
                return float(v) if v is not None else None

            contracts.append(OptionContract(
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
                delta=_rf("delta"),
                gamma=_rf("gamma"),
                theta=_rf("theta"),
                vega=_rf("vega"),
                iv_rank=iv_rank,
            ))
    return contracts


# ─────────────────────────────────────────────────────────────────────────────
# DataProvider implementation  (read-only — screener uses these methods)
# ─────────────────────────────────────────────────────────────────────────────

class YFinanceProvider(DataProvider):
    """Read-only provider: returns cached data only.

    Call refresh_batch_prices() + refresh_fundamentals() + refresh_option_chain()
    from the scheduler to populate the cache. User-facing endpoints never touch
    Yahoo Finance directly.
    """

    def get_quote(self, ticker: str) -> StockQuote:
        r = _get_redis()
        price_str = r.get(f"price:{ticker}")
        fund_raw = r.get(f"fundamentals:{ticker}")

        if fund_raw is None:
            raise RuntimeError(f"No fundamentals cached for {ticker}")

        quote = StockQuote(**json.loads(fund_raw))
        if price_str is not None:
            quote.price = float(price_str)

        return quote

    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        try:
            raw = _get_redis().get(f"chain:{ticker}:{min_dte}:{max_dte}")
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass
        return []
