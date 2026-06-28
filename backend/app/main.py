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
    version="0.4.0",
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


@app.on_event("startup")
async def startup_event() -> None:
    from app.data.scheduler import DataRefreshScheduler

    if settings.DATA_PROVIDER == "tradier" and settings.TRADIER_TOKEN:
        from app.data.tradier_provider import TradierProvider, tradier_refresh
        _provider = TradierProvider()
        _refresh_fn = tradier_refresh
    else:
        from app.data.yfinance_provider import YFinanceProvider
        _provider = YFinanceProvider()
        _refresh_fn = None  # scheduler uses built-in yfinance flow

    screener.provider = _provider

    _scheduler = DataRefreshScheduler(
        tickers=DEFAULT_UNIVERSE,
        refresh_fn=_refresh_fn,
    )
    app.state.scheduler = _scheduler
    _scheduler.start()
    screener.scheduler = _scheduler
