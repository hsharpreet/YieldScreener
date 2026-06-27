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
    """Background thread: slowly pre-fetches all default-universe quotes into Redis.

    Uses a 3-second gap between tickers so Yahoo Finance never sees a burst.
    The screener reads from cache on the user's first request, making it fast.
    """
    # Wait for the server to fully start before making outbound requests.
    time.sleep(5)
    from app.data.yfinance_provider import YFinanceProvider
    provider = YFinanceProvider()
    for i, ticker in enumerate(DEFAULT_UNIVERSE):
        try:
            provider.get_quote(ticker)
        except Exception:
            pass
        if i < len(DEFAULT_UNIVERSE) - 1:
            time.sleep(3)


@app.on_event("startup")
async def startup_event() -> None:
    t = threading.Thread(target=_warm_cache, daemon=True)
    t.start()
