from __future__ import annotations

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# Engine and session factory are created on first access so that importing
# this module in a test environment (without a live Postgres) does not fail
# at collection time.
_engine: Engine | None = None
_SessionLocal: sessionmaker | None = None


def _get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    return _engine


def _get_session_factory() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=_get_engine()
        )
    return _SessionLocal


# Convenience alias used by routers that import engine directly (e.g. billing webhook)
@property  # type: ignore[misc]
def engine() -> Engine:  # noqa: D401 — simple alias
    return _get_engine()


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    factory = _get_session_factory()
    db: Session = factory()
    try:
        yield db
    finally:
        db.close()
