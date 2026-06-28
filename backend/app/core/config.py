from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/yieldscreener"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str = "dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30
    CORS_ORIGINS: str = "http://localhost:3000"
    BILLING_ENABLED: bool = False
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""

    # ── yfinance data refresh ─────────────────────────────────────────────────
    # How often (seconds) the background scheduler re-fetches all market data.
    # Screener reads from Redis cache only — Yahoo Finance is never called on a
    # user request. Set in .env: YF_REFRESH_INTERVAL=600
    YF_REFRESH_INTERVAL: int = 600          # 10 minutes

    # Seconds to sleep between retry attempts when Yahoo returns a 429.
    YF_RETRY_SLEEP: float = 1.0

    # Max retries per ticker before giving up and moving on.
    YF_MAX_RETRIES: int = 3

    # User-Agent sent to Yahoo Finance (helps avoid bot detection).
    YF_USER_AGENT: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )


settings = Settings()
