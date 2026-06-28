from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, billing, health, screener, screeners, watchlist

app = FastAPI(
    title="Yield Screener API",
    description=(
        "Quality-first covered-call screener. "
        "Educational information, not investment advice."
    ),
    version="0.3.0",
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

# No startup warm cache.
# Reason: firing 21+ yfinance requests at startup races with the first user
# request and bursts Yahoo Finance → corrupts the shared crumb → all subsequent
# calls fail with 429 regardless of rate limiting.
# Instead: the global _yf_gate semaphore in yfinance_provider.py serialises all
# outbound Yahoo calls to ≤1 per 0.6 s. Redis caches results so the SECOND
# screener run is instant. First run takes ~25 s for 21 tickers — acceptable
# until the yfinance → marketdata.app swap (DataProvider ABC is ready).
