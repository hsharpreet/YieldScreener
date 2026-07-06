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

PRICE_TTL = settings.YF_REFRESH_INTERVAL * 4      # 40 min — survives 3 missed refresh cycles
FUNDAMENTALS_TTL = 86_400                          # 24 h — quarterly data
CHAIN_TTL = settings.YF_REFRESH_INTERVAL * 4      # 40 min — same as PRICE_TTL
EARNINGS_TTL = 86_400                             # 24 h — earnings dates don't change intraday
EXPIRY_LIST_TTL = 86_400                          # 24 h — option expiry calendar is stable
LEAPS_TTL = 21_600                                # 6 h — deep-ITM LEAPS move slowly
TECHNICALS_TTL = 86_400                           # 24 h — daily-bar indicators

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
# Technicals refresh  (called by scheduler — ONE HTTP call for all tickers)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_technicals(tickers: list[str]) -> None:
    """Compute RSI(14) / SMA(50) / SMA(200) from one batched 1-year daily
    download; store per ticker in Redis (24 h TTL). Skips tickers already
    cached, so steady-state cost is zero."""
    r = _get_redis()
    try:
        missing = [t for t in tickers if not r.get(f"technicals:{t}")]
    except Exception:
        missing = list(tickers)
    if not missing:
        return

    def _download():
        return yf.download(
            " ".join(missing),
            period="1y",
            interval="1d",
            auto_adjust=True,
            progress=False,
            session=_yf_session,
        )

    try:
        data = _yf_retry(_download)
    except Exception:
        return
    if data is None or data.empty:
        return

    for ticker in missing:
        try:
            if isinstance(data.columns, pd.MultiIndex):
                closes = data["Close"][ticker].dropna()
            else:
                closes = data["Close"].dropna()
            tech = _compute_technicals(closes)
            if tech:
                r.setex(f"technicals:{ticker}", TECHNICALS_TTL, json.dumps(tech))
        except Exception:
            continue


def _compute_technicals(closes: "pd.Series") -> dict | None:
    """RSI(14) via Wilder smoothing + simple moving averages from daily closes."""
    if len(closes) < 15:
        return None
    delta = closes.diff().dropna()
    gains = delta.clip(lower=0.0)
    losses = -delta.clip(upper=0.0)
    avg_gain = gains.ewm(alpha=1 / 14, min_periods=14).mean().iloc[-1]
    avg_loss = losses.ewm(alpha=1 / 14, min_periods=14).mean().iloc[-1]
    if avg_loss == 0:
        rsi = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi = 100.0 - 100.0 / (1.0 + rs)
    return {
        "rsi_14": round(float(rsi), 2),
        "sma_50": round(float(closes.tail(50).mean()), 4) if len(closes) >= 50 else None,
        "sma_200": round(float(closes.tail(200).mean()), 4) if len(closes) >= 200 else None,
    }


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
            # Valuation extras
            price_to_book=_f("priceToBook"),
            price_to_sales=_f("priceToSalesTrailing12Months"),
            ev_to_ebitda=_f("enterpriseToEbitda"),
            # Profitability
            gross_margin=_f("grossMargins"),
            operating_margin=_f("operatingMargins"),
            net_margin=_f("profitMargins"),
            roa=_f("returnOnAssets"),
            # Financial health
            debt_to_equity=_f("debtToEquity"),
            current_ratio=_f("currentRatio"),
            quick_ratio=_f("quickRatio"),
            # Trading / market
            short_float=_f("shortPercentOfFloat"),
            target_price=_f("targetMeanPrice"),
            fifty_two_week_high=_f("fiftyTwoWeekHigh"),
            fifty_two_week_low=_f("fiftyTwoWeekLow"),
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
    """Fetch option chain for one ticker, store in Redis, return CALL contracts.

    Each Yahoo option_chain() response carries calls AND puts, so puts are
    cached too (putchain:*) at zero extra HTTP cost.
    """
    cache_key = f"chain:{ticker}:{min_dte}:{max_dte}"

    with _ticker_lock(cache_key):
        # Skip if recently refreshed.
        try:
            raw = _get_redis().get(cache_key)
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass

        calls, puts = _fetch_chain(ticker, min_dte, max_dte)

        try:
            r = _get_redis()
            r.setex(cache_key, CHAIN_TTL, json.dumps([c.__dict__ for c in calls]))
            r.setex(
                f"putchain:{ticker}:{min_dte}:{max_dte}",
                CHAIN_TTL,
                json.dumps([c.__dict__ for c in puts]),
            )
        except Exception:
            pass

        return calls


def refresh_leaps_chain(
    ticker: str, min_dte: int = 180, max_dte: int = 730
) -> list[OptionContract]:
    """Fetch long-dated call chains (PMCC long legs). Cached 6 h — LEAPS are slow."""
    cache_key = f"leaps:{ticker}"

    with _ticker_lock(cache_key):
        try:
            raw = _get_redis().get(cache_key)
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass

        calls, _puts = _fetch_chain(ticker, min_dte, max_dte)
        # Keep only the deep-ITM half plus a buffer — the PMCC long leg is
        # never OTM, and dropping OTM strikes keeps the cache entry small.
        price = _cached_price(ticker)
        if price:
            calls = [c for c in calls if c.strike <= price * 1.05]

        try:
            _get_redis().setex(cache_key, LEAPS_TTL, json.dumps([c.__dict__ for c in calls]))
        except Exception:
            pass

        return calls


def _cached_price(ticker: str) -> float | None:
    try:
        raw = _get_redis().get(f"price:{ticker}")
        return float(raw) if raw is not None else None
    except Exception:
        return None


def _si(val) -> int:
    """Safe int: NaN / None → 0. yfinance returns NaN for volume/OI off-hours;
    float('nan') is truthy so `val or 0` does NOT catch it; int(nan) raises."""
    try:
        f = float(val)
        return 0 if f != f else int(f)  # f != f is True only for NaN
    except (TypeError, ValueError):
        return 0


def _sf(val) -> float | None:
    """Safe float: NaN / None → None."""
    try:
        f = float(val)
        return None if f != f else f
    except (TypeError, ValueError):
        return None


def _parse_chain_df(
    df,
    ticker: str,
    exp_str: str,
    dte: int,
    earnings_flag: bool,
    price: float | None,
    option_type: str,
) -> list[OptionContract]:
    """Turn one yfinance calls/puts DataFrame into OptionContracts.

    Yahoo supplies IV but no Greeks — when delta is absent we estimate it
    with Black-Scholes from the cached underlying price (marked as an
    estimate in the UI; providers with real Greeks keep theirs).
    """
    from app.options.greeks import bs_call_delta, bs_put_delta

    iv_vals = [
        v for _, row in df.iterrows()
        if (v := _sf(row.get("impliedVolatility"))) is not None
    ]
    iv_min = min(iv_vals) if iv_vals else None
    iv_max = max(iv_vals) if iv_vals else None
    iv_range = (iv_max - iv_min) if iv_min is not None and iv_max is not None else None

    contracts: list[OptionContract] = []
    for _, row in df.iterrows():
        bid = _sf(row.get("bid")) or 0.0
        ask = _sf(row.get("ask")) or 0.0
        if bid <= 0 or ask <= 0:
            continue
        premium = (bid + ask) / 2
        strike = float(row["strike"])
        cur_iv = _sf(row.get("impliedVolatility"))
        iv_rank = (
            (cur_iv - iv_min) / iv_range * 100
            if iv_range and iv_range > 0 and cur_iv is not None and iv_min is not None
            else None
        )
        delta = _sf(row.get("delta"))
        if delta is None and price and cur_iv:
            delta = (
                bs_put_delta(price, strike, dte, cur_iv)
                if option_type == "put"
                else bs_call_delta(price, strike, dte, cur_iv)
            )

        contracts.append(OptionContract(
            ticker=ticker,
            strike=strike,
            expiry=exp_str,
            dte=dte,
            premium=premium,
            bid=bid,
            ask=ask,
            volume=_si(row.get("volume")),
            open_interest=_si(row.get("openInterest")),
            implied_volatility=cur_iv or 0.0,
            earnings_within_dte=earnings_flag,
            delta=delta,
            gamma=_sf(row.get("gamma")),
            theta=_sf(row.get("theta")),
            vega=_sf(row.get("vega")),
            iv_rank=iv_rank,
            option_type=option_type,
        ))
    return contracts


def _fetch_chain(
    ticker: str, min_dte: int, max_dte: int
) -> tuple[list[OptionContract], list[OptionContract]]:
    """Fetch chains for every expiry in range. Returns (calls, puts)."""
    t = yf.Ticker(ticker, session=_yf_session)
    today = datetime.date.today()
    r = _get_redis()
    price = _cached_price(ticker)

    # ── Earnings date: cached 24 h (never changes intraday) ───────────────────
    earnings_date: datetime.date | None = None
    try:
        cached_earnings = r.get(f"earnings:{ticker}")
        if cached_earnings is not None:
            earnings_date = (
                datetime.date.fromisoformat(cached_earnings)
                if cached_earnings != "none"
                else None
            )
        else:
            cal = _yf_retry(lambda: t.calendar)
            if cal is not None and "Earnings Date" in cal:
                ed = cal["Earnings Date"]
                if hasattr(ed, "__iter__"):
                    ed = list(ed)[0]
                earnings_date = pd.Timestamp(ed).date() if hasattr(ed, "date") else None
            r.setex(
                f"earnings:{ticker}",
                EARNINGS_TTL,
                str(earnings_date) if earnings_date else "none",
            )
    except Exception:
        earnings_date = None

    # ── Expiry list: cached 24 h (exchange calendar is stable within a day) ───
    try:
        cached_expiries = r.get(f"expirations:{ticker}")
        if cached_expiries is not None:
            all_options = json.loads(cached_expiries)
        else:
            all_options = _yf_retry(lambda: t.options)
            r.setex(f"expirations:{ticker}", EXPIRY_LIST_TTL, json.dumps(list(all_options)))
    except Exception:
        return []

    valid_expiries = [
        (exp_str, (datetime.date.fromisoformat(exp_str) - today).days)
        for exp_str in all_options
        if min_dte <= (datetime.date.fromisoformat(exp_str) - today).days <= max_dte
    ]

    calls: list[OptionContract] = []
    puts: list[OptionContract] = []
    for exp_str, dte in valid_expiries:
        try:
            chain = _yf_retry(lambda: t.option_chain(exp_str))
        except Exception:
            continue

        earnings_flag = (
            earnings_date is not None
            and today < earnings_date <= today + datetime.timedelta(days=dte)
        )
        calls.extend(_parse_chain_df(
            chain.calls, ticker, exp_str, dte, earnings_flag, price, "call"
        ))
        puts.extend(_parse_chain_df(
            chain.puts, ticker, exp_str, dte, earnings_flag, price, "put"
        ))
    return calls, puts


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

        # Merge cached technicals (RSI / SMAs) when the scheduler has them.
        try:
            tech_raw = r.get(f"technicals:{ticker}")
            if tech_raw:
                tech = json.loads(tech_raw)
                quote.rsi_14 = tech.get("rsi_14")
                quote.sma_50 = tech.get("sma_50")
                quote.sma_200 = tech.get("sma_200")
        except Exception:
            pass

        return quote

    def get_call_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        r = _get_redis()
        # Try exact cache key first (covers the case where the scheduler cached
        # a narrower window that exactly matches the request).
        try:
            raw = r.get(f"chain:{ticker}:{min_dte}:{max_dte}")
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass

        # Fall back to the broad 7-60 cache the scheduler always stores, then
        # filter in memory. This means ANY user DTE range is served instantly.
        try:
            raw = r.get(f"chain:{ticker}:7:60")
            if raw:
                all_contracts = [OptionContract(**d) for d in json.loads(raw)]
                return [c for c in all_contracts if min_dte <= c.dte <= max_dte]
        except Exception:
            pass

        return []

    def get_put_options(
        self,
        ticker: str,
        min_dte: int = 21,
        max_dte: int = 45,
    ) -> list[OptionContract]:
        r = _get_redis()
        try:
            raw = r.get(f"putchain:{ticker}:{min_dte}:{max_dte}")
            if raw:
                return [OptionContract(**d) for d in json.loads(raw)]
        except Exception:
            pass

        # Same broad-cache fallback as calls.
        try:
            raw = r.get(f"putchain:{ticker}:7:60")
            if raw:
                all_contracts = [OptionContract(**d) for d in json.loads(raw)]
                return [c for c in all_contracts if min_dte <= c.dte <= max_dte]
        except Exception:
            pass

        return []

    def get_leaps_calls(
        self,
        ticker: str,
        min_dte: int = 180,
        max_dte: int = 730,
    ) -> list[OptionContract]:
        try:
            raw = _get_redis().get(f"leaps:{ticker}")
            if raw:
                all_contracts = [OptionContract(**d) for d in json.loads(raw)]
                return [c for c in all_contracts if min_dte <= c.dte <= max_dte]
        except Exception:
            pass
        return []
