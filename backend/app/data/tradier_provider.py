"""Tradier data provider.

Architecture
────────────
• Prices     — GET /v1/markets/quotes?symbols=ALL (ONE HTTP call for all tickers)
• Fundamentals — yfinance .info per ticker, cached 24 h (Tradier doesn't supply P/E etc.)
• Option chains — GET /v1/markets/options/chains per ticker per expiry, parallelised

The background scheduler calls refresh_* functions below.
The screener endpoint reads exclusively from Redis (same keys as yfinance_provider).

Rate limits: Tradier production = 120 req/min. With ThreadPoolExecutor(max_workers=3)
and ~42 chain calls for 21 tickers × 2 expirations, the full refresh cycle completes
in < 30 seconds — well within the 120-req/min limit.
"""
from __future__ import annotations

import datetime
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import redis as redis_lib
import requests

from app.core.config import settings
from app.data.provider import DataProvider, OptionContract, StockQuote

# ── Redis ──────────────────────────────────────────────────────────────────────
_redis: redis_lib.Redis | None = None

PRICE_TTL = settings.YF_REFRESH_INTERVAL * 4       # 40 min
CHAIN_TTL = settings.YF_REFRESH_INTERVAL * 4       # 40 min
EXPIRY_TTL = 86_400                                 # 24 h — expirations don't change intraday
FUNDAMENTALS_TTL = 86_400                           # 24 h

_tradier_lock = threading.Lock()                    # serialise non-parallel calls if needed


def _get_redis() -> redis_lib.Redis:
    global _redis
    if _redis is None:
        _redis = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _tradier_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {settings.TRADIER_TOKEN}",
        "Accept": "application/json",
    })
    return s


def _get(path: str, params: dict | None = None) -> dict:
    s = _tradier_session()
    resp = s.get(f"https://api.tradier.com/v1{path}", params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sf(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if f != f else f  # NaN guard
    except (TypeError, ValueError):
        return None


def _si(val) -> int:
    try:
        f = float(val)
        return 0 if f != f else int(f)
    except (TypeError, ValueError):
        return 0


# ─────────────────────────────────────────────────────────────────────────────
# Bulk price refresh  (1 HTTP call for all tickers)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_quotes_bulk(tickers: list[str]) -> dict[str, float]:
    """Fetch all stock prices in one Tradier call. Writes price:{ticker} to Redis."""
    data = _get("/markets/quotes", {"symbols": ",".join(tickers), "greeks": "false"})

    quotes_data = data.get("quotes", {})
    raw = quotes_data.get("quote")
    if raw is None:
        return {}

    # Tradier returns object (single ticker) or list (multiple tickers).
    if isinstance(raw, dict):
        raw = [raw]

    prices: dict[str, float] = {}
    r = _get_redis()
    for q in raw:
        sym = q.get("symbol", "").upper()
        # Use last traded price; fall back to bid/ask midpoint if after-hours.
        price = _sf(q.get("last")) or (
            (_sf(q.get("bid") or 0) + _sf(q.get("ask") or 0)) / 2
        )
        if price and price > 0:
            prices[sym] = price
            try:
                r.setex(f"price:{sym}", PRICE_TTL, str(price))
            except Exception:
                pass

    return prices


# ─────────────────────────────────────────────────────────────────────────────
# Expiration dates  (cached 24 h per ticker)
# ─────────────────────────────────────────────────────────────────────────────

def get_expirations(ticker: str) -> list[str]:
    """Return available option expiration date strings (YYYY-MM-DD) for ticker.

    Result is cached in Redis for 24 h — expiration dates don't change intraday.
    """
    r = _get_redis()
    cache_key = f"expirations:{ticker}"
    try:
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    data = _get("/markets/options/expirations", {"symbol": ticker, "includeAllRoots": "true"})
    expirations_data = data.get("expirations") or {}

    dates: list[str] = []

    # Tradier returns either {"expiration": [{"date": "...", ...}]} or {"date": [...]}
    if "expiration" in expirations_data:
        raw = expirations_data["expiration"]
        if isinstance(raw, dict):
            raw = [raw]
        dates = [e["date"] for e in raw if "date" in e]
    elif "date" in expirations_data:
        raw = expirations_data["date"]
        dates = raw if isinstance(raw, list) else [raw]

    try:
        r.setex(cache_key, EXPIRY_TTL, json.dumps(dates))
    except Exception:
        pass

    return dates


# ─────────────────────────────────────────────────────────────────────────────
# Option chain refresh  (one call per expiration per ticker)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_option_chain(
    ticker: str,
    min_dte: int = 7,
    max_dte: int = 60,
) -> list[OptionContract]:
    """Fetch call option chains for ticker within the DTE window; write to Redis."""
    today = datetime.date.today()
    all_expirations = get_expirations(ticker)

    valid: list[tuple[str, int]] = []
    for exp_str in all_expirations:
        try:
            exp_date = datetime.date.fromisoformat(exp_str)
            dte = (exp_date - today).days
            if min_dte <= dte <= max_dte:
                valid.append((exp_str, dte))
        except ValueError:
            continue

    contracts: list[OptionContract] = []
    for exp_str, dte in valid:
        try:
            chain_contracts = _fetch_chain_for_expiry(ticker, exp_str, dte)
            contracts.extend(chain_contracts)
        except Exception:
            continue

    cache_key = f"chain:{ticker}:{min_dte}:{max_dte}"
    try:
        _get_redis().setex(cache_key, CHAIN_TTL, json.dumps([c.__dict__ for c in contracts]))
    except Exception:
        pass

    return contracts


def _fetch_chain_for_expiry(ticker: str, exp_str: str, dte: int) -> list[OptionContract]:
    data = _get(
        "/markets/options/chains",
        {"symbol": ticker, "expiration": exp_str, "greeks": "true"},
    )
    options_data = data.get("options") or {}
    raw = options_data.get("option")
    if not raw:
        return []
    if isinstance(raw, dict):
        raw = [raw]

    # Compute IV rank (within-chain normalization, same approach as yfinance provider)
    iv_vals = [
        _sf(o.get("greeks", {}).get("mid_iv") if o.get("greeks") else None)
        or _sf(o.get("implied_volatility"))
        for o in raw
        if o.get("option_type") == "call"
    ]
    iv_vals = [v for v in iv_vals if v is not None]
    iv_min = min(iv_vals) if iv_vals else None
    iv_max = max(iv_vals) if iv_vals else None
    iv_range = (iv_max - iv_min) if iv_min is not None and iv_max is not None else None

    contracts: list[OptionContract] = []
    for o in raw:
        if o.get("option_type") != "call":
            continue
        bid = _sf(o.get("bid")) or 0.0
        ask = _sf(o.get("ask")) or 0.0
        if bid <= 0 or ask <= 0:
            continue
        premium = (bid + ask) / 2

        greeks = o.get("greeks") or {}
        cur_iv = _sf(greeks.get("mid_iv")) or _sf(o.get("implied_volatility")) or 0.0
        iv_rank = (
            (cur_iv - iv_min) / iv_range * 100
            if iv_range and iv_range > 0 and cur_iv and iv_min is not None
            else None
        )

        contracts.append(OptionContract(
            ticker=ticker,
            strike=float(o.get("strike", 0)),
            expiry=exp_str,
            dte=dte,
            premium=premium,
            bid=bid,
            ask=ask,
            volume=_si(o.get("volume")),
            open_interest=_si(o.get("open_interest")),
            implied_volatility=cur_iv,
            earnings_within_dte=False,  # Tradier doesn't supply earnings calendar
            delta=_sf(greeks.get("delta")),
            gamma=_sf(greeks.get("gamma")),
            theta=_sf(greeks.get("theta")),
            vega=_sf(greeks.get("vega")),
            iv_rank=iv_rank,
        ))

    return contracts


# ─────────────────────────────────────────────────────────────────────────────
# Full scheduler refresh function  (called by DataRefreshScheduler)
# ─────────────────────────────────────────────────────────────────────────────

def tradier_refresh(tickers: list[str]) -> None:
    """One full refresh cycle using Tradier for prices/options + yfinance for fundamentals."""
    import logging
    logger = logging.getLogger(__name__)

    # Step 1: Bulk stock prices — 1 HTTP call
    try:
        prices = refresh_quotes_bulk(tickers)
        logger.info("tradier_refresh: got prices for %d/%d tickers", len(prices), len(tickers))
    except Exception as exc:
        logger.warning("tradier_refresh: bulk quotes failed: %s", exc)

    # Step 2: Fundamentals via yfinance — 1 call/ticker, cached 24 h
    from app.data.yfinance_provider import refresh_fundamentals
    for ticker in tickers:
        try:
            refresh_fundamentals(ticker)
        except Exception as exc:
            logger.debug("tradier_refresh: fundamentals failed for %s: %s", ticker, exc)

    # Step 3: Option chains — parallel fetches (max_workers=3, well under 120 req/min)
    def _fetch(ticker: str) -> None:
        try:
            refresh_option_chain(ticker, min_dte=7, max_dte=60)
        except Exception as exc:
            logger.debug("tradier_refresh: chain failed for %s: %s", ticker, exc)

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(_fetch, t) for t in tickers]
        for f in as_completed(futures):
            f.result()  # surface exceptions to the logger above


# ─────────────────────────────────────────────────────────────────────────────
# DataProvider implementation  (read-only — identical to YFinanceProvider)
# ─────────────────────────────────────────────────────────────────────────────

class TradierProvider(DataProvider):
    """Read-only provider: returns data cached in Redis by tradier_refresh()."""

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
        r = _get_redis()
        try:
            raw = r.get(f"chain:{ticker}:{min_dte}:{max_dte}")
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass

        # Fall back to broad 7-60 cache and filter in memory.
        try:
            raw = r.get(f"chain:{ticker}:7:60")
            if raw:
                all_contracts = [OptionContract(**d) for d in json.loads(raw)]
                return [c for c in all_contracts if min_dte <= c.dte <= max_dte]
        except Exception:
            pass

        return []
