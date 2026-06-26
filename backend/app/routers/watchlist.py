from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_pro
from app.db.models import User, WatchlistItem

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistIn(BaseModel):
    ticker: str


@router.get("", response_model=list[str])
def get_watchlist(
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
) -> list[str]:
    """Return the ticker symbols in the user's watchlist (Pro tier required)."""
    items = db.query(WatchlistItem).filter(WatchlistItem.user_id == user.id).all()
    return [i.ticker for i in items]


@router.post("", status_code=201)
def add_to_watchlist(
    body: WatchlistIn,
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
) -> None:
    """Add a ticker to the watchlist — idempotent (Pro tier required)."""
    ticker = body.ticker.upper().strip()
    already_exists = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == user.id, WatchlistItem.ticker == ticker)
        .first()
    )
    if already_exists:
        return
    db.add(WatchlistItem(user_id=user.id, ticker=ticker))
    db.commit()


@router.delete("/{ticker}", status_code=204)
def remove_from_watchlist(
    ticker: str,
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
) -> None:
    """Remove a ticker from the watchlist (Pro tier required)."""
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == user.id, WatchlistItem.ticker == ticker.upper())
        .first()
    )
    if item:
        db.delete(item)
        db.commit()
