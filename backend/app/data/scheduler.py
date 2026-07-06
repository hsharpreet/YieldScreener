"""Background data refresh scheduler.

Runs in a daemon thread. Every YF_REFRESH_INTERVAL seconds (default 10 min):
  - Calls refresh_fn(tickers) to populate Redis with fresh market data.
  - Exposes `ready` (first refresh done) and `stale` (refresh overdue) flags
    so the screener can report X-Data-Status accurately.

refresh_fn is injected by main.py. Defaults to the built-in yfinance flow.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class DataRefreshScheduler:
    def __init__(
        self,
        tickers: list[str],
        interval: int = settings.YF_REFRESH_INTERVAL,
        refresh_fn: Optional[Callable[[list[str]], None]] = None,
    ):
        self.tickers = tickers
        self.interval = interval
        self._refresh_fn = refresh_fn  # None → use built-in yfinance flow
        self._stop = threading.Event()
        self._ready = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_refresh_at: float = 0.0

    @property
    def ready(self) -> bool:
        return self._ready.is_set()

    @property
    def stale(self) -> bool:
        """True when the last successful refresh was more than 2× the interval ago."""
        return (
            self.last_refresh_at > 0.0
            and time.time() - self.last_refresh_at > 2 * self.interval
        )

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True, name="data-refresh")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        self._refresh()
        while not self._stop.wait(self.interval):
            self._refresh()

    def _refresh(self) -> None:
        logger.info("DataRefreshScheduler: starting refresh for %d tickers", len(self.tickers))
        t0 = time.time()
        try:
            if self._refresh_fn is not None:
                self._refresh_fn(self.tickers)
            else:
                self._default_yf_refresh()
        except Exception as exc:
            logger.warning("DataRefreshScheduler: refresh failed: %s", exc)
            return

        elapsed = time.time() - t0
        self.last_refresh_at = time.time()
        self._ready.set()
        logger.info("DataRefreshScheduler: refresh done in %.1f s", elapsed)

    def _default_yf_refresh(self) -> None:
        """Built-in yfinance refresh — used when no refresh_fn is injected."""
        from app.data.yfinance_provider import (
            refresh_batch_prices,
            refresh_fundamentals,
            refresh_leaps_chain,
            refresh_option_chain,
            refresh_technicals,
        )

        try:
            prices = refresh_batch_prices(self.tickers)
            logger.info(
                "DataRefreshScheduler: got prices for %d/%d tickers",
                len(prices),
                len(self.tickers),
            )
        except Exception as exc:
            logger.warning("DataRefreshScheduler: batch price download failed: %s", exc)

        try:
            refresh_technicals(self.tickers)  # one batched call; 24 h cache
        except Exception as exc:
            logger.warning("DataRefreshScheduler: technicals refresh failed: %s", exc)

        for ticker in self.tickers:
            if self._stop.is_set():
                return
            try:
                refresh_fundamentals(ticker)
            except Exception as exc:
                logger.debug("DataRefreshScheduler: fundamentals failed for %s: %s", ticker, exc)

        for ticker in self.tickers:
            if self._stop.is_set():
                return
            try:
                refresh_option_chain(ticker, min_dte=7, max_dte=60)
            except Exception as exc:
                logger.debug("DataRefreshScheduler: chain failed for %s: %s", ticker, exc)

        # LEAPS for PMCC long legs — cached 6 h, so most cycles skip the fetch.
        for ticker in self.tickers:
            if self._stop.is_set():
                return
            try:
                refresh_leaps_chain(ticker)
            except Exception as exc:
                logger.debug("DataRefreshScheduler: LEAPS failed for %s: %s", ticker, exc)
