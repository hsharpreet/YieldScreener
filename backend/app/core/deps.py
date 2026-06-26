from fastapi import Cookie, Depends, HTTPException
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.base import get_db
from app.db.models import User


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(401, "Not authenticated")
    try:
        user_id = decode_access_token(access_token)
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(401, "User not found")
    return user


def get_optional_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    if not access_token:
        return None
    try:
        user_id = decode_access_token(access_token)
        return db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    except Exception:
        return None


def require_pro(user: User = Depends(get_current_user)) -> User:
    if user.tier != "pro":
        raise HTTPException(402, "Pro subscription required")
    return user
