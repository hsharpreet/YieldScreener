import threading
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, billing, health, screener, screeners, watchlist
from app.routers.screener import DEFAULT_UNIVERSE

app = FastAPI(
    title="Yield Screener API",
    description=(
        "Quality-first covered-call screener. "
        "Educational information, not investment advice."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(screener.router)
app.include_router(auth.router)
app.include_router(screeners.router)
app.include_router(watchlist.router)
app.include_router(billing.router)


def _warm_cache() -> None:
    """Background thread: pre-fetches quotes AND option chains for the default
    universe into Redis so the first user request reads from cache, not Yahoo.

    Uses a 3-second gap between tickers (quotes), then a further 3-second gap
    before the option chain for the same ticker, keeping burst rate well under
    Yahoo Finance's ~20 req/min threshold.
    """
    time.sleep(5)  # Let the server fully start before making outbound requests.
    from app.data.yfinance_provider import YFinanceProvider
    provider = YFinanceProvider()

    for i, ticker in enumerate(DEFAULT_UNIVERSE):
        if i > 0:
            time.sleep(3)  # pace between tickers
        try:
            provider.get_quote(ticker)
        except Exception:
            pass

        time.sleep(3)  # gap before fetching option chains for the same ticker

        try:
            # Warm the default DTE window (21–45) that the screener uses.
            provider.get_call_options(ticker, min_dte=21, max_dte=45)
        except Exception:
            pass


@app.on_event("startup")
async def startup_event() -> None:
    t = threading.Thread(target=_warm_cache, daemon=True)
    t.start()
