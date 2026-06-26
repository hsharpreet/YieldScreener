from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import get_db
from app.db.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    tier: str
    created_at: datetime


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production behind HTTPS
        max_age=30 * 24 * 3600,
    )


@router.post("/register", response_model=UserOut)
def register(
    body: RegisterIn,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    """Register a new user account.

    Educational information only — not investment advice.
    """
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_cookie(response, create_access_token(user.id))
    return UserOut(
        id=user.id,
        email=user.email,
        tier=user.tier,
        created_at=user.created_at,
    )


@router.post("/login", response_model=UserOut)
def login(
    body: RegisterIn,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    """Authenticate and receive a session cookie."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    _set_cookie(response, create_access_token(user.id))
    return UserOut(
        id=user.id,
        email=user.email,
        tier=user.tier,
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    """Return the currently authenticated user."""
    return UserOut(
        id=user.id,
        email=user.email,
        tier=user.tier,
        created_at=user.created_at,
    )


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    """Clear the session cookie."""
    response.delete_cookie("access_token")
