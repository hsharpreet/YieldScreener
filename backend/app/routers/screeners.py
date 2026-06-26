from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_pro
from app.db.models import SavedScreener, User

router = APIRouter(prefix="/api/screeners", tags=["screeners"])


class ScreenerParams(BaseModel):
    min_dte: int = 21
    max_dte: int = 45
    min_market_cap: float = 5_000_000_000
    max_pe: float = 50.0
    tickers: str | None = None


class SavedScreenerIn(BaseModel):
    name: str
    params: ScreenerParams


class SavedScreenerOut(BaseModel):
    id: str
    name: str
    params: ScreenerParams
    created_at: datetime


@router.get("", response_model=list[SavedScreenerOut])
def list_screeners(
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
) -> list[SavedScreenerOut]:
    """List all saved screeners for the authenticated Pro user."""
    rows = db.query(SavedScreener).filter(SavedScreener.user_id == user.id).all()
    return [
        SavedScreenerOut(
            id=r.id,
            name=r.name,
            params=ScreenerParams(**r.params),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("", response_model=SavedScreenerOut, status_code=201)
def save_screener(
    body: SavedScreenerIn,
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
) -> SavedScreenerOut:
    """Save a screener configuration (Pro tier required)."""
    existing = (
        db.query(SavedScreener)
        .filter(SavedScreener.user_id == user.id, SavedScreener.name == body.name)
        .first()
    )
    if existing:
        raise HTTPException(409, "A screener with that name already exists")
    s = SavedScreener(
        user_id=user.id,
        name=body.name,
        params=body.params.model_dump(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return SavedScreenerOut(
        id=s.id,
        name=s.name,
        params=body.params,
        created_at=s.created_at,
    )


@router.delete("/{screener_id}", status_code=204)
def delete_screener(
    screener_id: str,
    user: User = Depends(require_pro),
    db: Session = Depends(get_db),
) -> None:
    """Delete a saved screener by ID (Pro tier required)."""
    s = (
        db.query(SavedScreener)
        .filter(SavedScreener.id == screener_id, SavedScreener.user_id == user.id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Not found")
    db.delete(s)
    db.commit()
