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
