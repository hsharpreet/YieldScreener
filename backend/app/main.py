from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, screener

app = FastAPI(
    title="Yield Screener API",
    description=(
        "Quality-first covered-call screener. "
        "Educational information, not investment advice."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(screener.router)
