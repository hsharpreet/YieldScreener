"""Background data refresh scheduler.

Runs in a daemon thread. Every YF_REFRESH_INTERVAL seconds (default 10 min):
  1. Batch-downloads current prices for all tickers in ONE yf.download() call.
  2. Fetches fundamentals for any ticker whose cache has expired (24 h TTL).
  3. Fetches option chains for all tickers one-by-one through the rate limiter.

The screener endpoint ONLY reads from Redis — it never calls Yahoo Finance.
If a screener request arrives before the first refresh completes, it receives
an empty list with the header X-Data-Status: loading.
"""
from __future__ import annotations

import logging
import threading
import time

from app.core.config import settings

logger = logging.getLogger(__name__)


class DataRefreshScheduler:
    def __init__(self, tickers: list[str], interval: int = settings.YF_REFRESH_INTERVAL):
        self.tickers = tickers
        self.interval = interval
        self._stop = threading.Event()
        self._ready = threading.Event()  # set once the first refresh completes
        self._thread: threading.Thread | None = None

    @property
    def ready(self) -> bool:
        return self._ready.is_set()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True, name="data-refresh")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        """Run one immediate refresh, then repeat every interval seconds."""
        self._refresh()
        while not self._stop.wait(self.interval):
            self._refresh()

    def _refresh(self) -> None:
        from app.data.yfinance_provider import (
            refresh_batch_prices,
            refresh_fundamentals,
            refresh_option_chain,
        )

        logger.info("DataRefreshScheduler: starting refresh for %d tickers", len(self.tickers))
        t0 = time.time()

        # ── Step 1: Batch price download (ONE HTTP call for all tickers) ───────
        try:
            prices = refresh_batch_prices(self.tickers)
            logger.info("DataRefreshScheduler: got prices for %d/%d tickers", len(prices), len(self.tickers))
        except Exception as exc:
            logger.warning("DataRefreshScheduler: batch price download failed: %s", exc)

        # ── Step 2: Fundamentals (individual calls, 24 h cache) ────────────────
        for ticker in self.tickers:
            if self._stop.is_set():
                return
            try:
                refresh_fundamentals(ticker)
            except Exception as exc:
                logger.debug("DataRefreshScheduler: fundamentals failed for %s: %s", ticker, exc)

        # ── Step 3: Option chains (individual calls, through rate limiter) ──────
        # Cache a broad DTE window (7-60) so any user-selected DTE range is served
        # from cache without a separate Yahoo request.
        for ticker in self.tickers:
            if self._stop.is_set():
                return
            try:
                refresh_option_chain(ticker, min_dte=7, max_dte=60)
            except Exception as exc:
                logger.debug("DataRefreshScheduler: chain failed for %s: %s", ticker, exc)

        elapsed = time.time() - t0
        logger.info("DataRefreshScheduler: refresh done in %.1f s", elapsed)
        self._ready.set()
