"""Tests for auth security helpers and billing gate.

DB-backed integration tests (register / login endpoints) require a live
Postgres instance and are exercised only in Docker CI.  The unit tests here
cover everything that does NOT need a real database.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Security helpers — pure unit tests, no DB or HTTP needed
# ---------------------------------------------------------------------------


def test_hash_and_verify() -> None:
    from app.core.security import hash_password, verify_password

    h = hash_password("mysecret")
    assert verify_password("mysecret", h)
    assert not verify_password("wrong", h)


def test_hash_produces_different_salts() -> None:
    from app.core.security import hash_password

    h1 = hash_password("samepassword")
    h2 = hash_password("samepassword")
    assert h1 != h2  # bcrypt uses random salts


def test_create_decode_token_roundtrip() -> None:
    from app.core.security import create_access_token, decode_access_token

    token = create_access_token("user-123")
    assert decode_access_token(token) == "user-123"


def test_token_contains_sub() -> None:
    from jose import jwt

    from app.core.config import settings
    from app.core.security import create_access_token

    token = create_access_token("abc-999")
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    assert payload["sub"] == "abc-999"


def test_decode_invalid_token_raises() -> None:
    from jose import JWTError

    from app.core.security import decode_access_token

    try:
        decode_access_token("not.a.valid.token")
        raise AssertionError("Expected JWTError")
    except JWTError:
        pass


# ---------------------------------------------------------------------------
# Billing gate — BILLING_ENABLED=False must return 503
# Uses FastAPI dependency_overrides to bypass auth without touching Postgres.
# ---------------------------------------------------------------------------


def _make_mock_user() -> MagicMock:
    user = MagicMock()
    user.id = "test-uuid"
    user.email = "test@example.com"
    user.tier = "free"
    user.created_at = datetime.now(timezone.utc)
    user.is_active = True
    return user


def test_billing_disabled_checkout_returns_503() -> None:
    """When BILLING_ENABLED is False, create-checkout-session returns 503."""
    from fastapi.testclient import TestClient

    from app.core.deps import get_current_user
    from app.main import app

    mock_user = _make_mock_user()
    app.dependency_overrides[get_current_user] = lambda: mock_user

    try:
        with patch("app.routers.billing.settings") as mock_settings:
            mock_settings.BILLING_ENABLED = False
            client = TestClient(app)
            r = client.post("/api/billing/create-checkout-session")
            assert r.status_code == 503
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_billing_disabled_subscription_returns_503() -> None:
    """When BILLING_ENABLED is False, GET /subscription returns 503."""
    from fastapi.testclient import TestClient

    from app.core.deps import get_current_user
    from app.main import app

    mock_user = _make_mock_user()
    app.dependency_overrides[get_current_user] = lambda: mock_user

    try:
        with patch("app.routers.billing.settings") as mock_settings:
            mock_settings.BILLING_ENABLED = False
            client = TestClient(app)
            r = client.get("/api/billing/subscription")
            assert r.status_code == 503
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Auth endpoints — mock the DB via dependency_overrides so no Postgres needed
# ---------------------------------------------------------------------------


def _make_db_override(first_return_value):
    """Return a FastAPI dependency that yields a mock session."""
    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = (
        first_return_value
    )

    def override():
        yield mock_session

    return override, mock_session


def test_register_endpoint_conflict() -> None:
    """If the email already exists the endpoint returns 409."""
    from fastapi.testclient import TestClient

    from app.db.base import get_db
    from app.main import app

    existing_user = _make_mock_user()
    existing_user.email = "taken@example.com"
    override, _ = _make_db_override(existing_user)
    app.dependency_overrides[get_db] = override

    try:
        client = TestClient(app)
        r = client.post(
            "/api/auth/register",
            json={"email": "taken@example.com", "password": "password123"},
        )
        assert r.status_code == 409
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_login_endpoint_invalid_credentials() -> None:
    """Wrong password (user not found) returns 401."""
    from fastapi.testclient import TestClient

    from app.db.base import get_db
    from app.main import app

    override, _ = _make_db_override(None)  # no user found
    app.dependency_overrides[get_db] = override

    try:
        client = TestClient(app)
        r = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
        )
        assert r.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_me_without_cookie_returns_401() -> None:
    """GET /api/auth/me without a session cookie returns 401."""
    from fastapi.testclient import TestClient

    from app.db.base import get_db
    from app.main import app

    # Override get_db so the dependency tree doesn't attempt a Postgres
    # connection; the auth check (no cookie) still fires before any DB query.
    override, _ = _make_db_override(None)
    app.dependency_overrides[get_db] = override

    try:
        client = TestClient(app)
        r = client.get("/api/auth/me")
        assert r.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_logout_returns_204() -> None:
    """POST /api/auth/logout always succeeds — no auth required to clear cookie."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    r = client.post("/api/auth/logout")
    assert r.status_code == 204
