from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.models import User

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _require_billing() -> None:
    if not settings.BILLING_ENABLED:
        raise HTTPException(503, "Billing not yet enabled — awaiting legal review")


class CheckoutOut(BaseModel):
    url: str


@router.post("/create-checkout-session", response_model=CheckoutOut)
def create_checkout(user: User = Depends(get_current_user)) -> CheckoutOut:
    """Create a Stripe checkout session for the Pro subscription.

    Gated behind BILLING_ENABLED; returns 503 until legal review is complete.
    """
    _require_billing()
    import stripe  # lazy import — not required when billing is disabled

    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user.email,
        line_items=[{"price": settings.STRIPE_PRO_PRICE_ID, "quantity": 1}],
        success_url="http://localhost:3000/?upgraded=1",
        cancel_url="http://localhost:3000/",
        subscription_data={
            "metadata": {"user_id": user.id},
        },
        custom_text={
            "submit": {
                "message": (
                    "Your subscription renews automatically each month. "
                    "Cancel anytime from account settings."
                )
            }
        },
    )
    return CheckoutOut(url=session.url)


@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None),
) -> dict[str, bool]:
    """Receive Stripe webhook events to update user tier in the database."""
    _require_billing()
    import stripe  # lazy import
    from sqlalchemy.orm import Session as OrmSession

    from app.db.base import _get_engine

    stripe.api_key = settings.STRIPE_SECRET_KEY
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")

    with OrmSession(_get_engine()) as db:
        if event["type"] == "customer.subscription.created":
            user_id = event["data"]["object"]["metadata"].get("user_id")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.tier = "pro"
                    db.commit()
        elif event["type"] in (
            "customer.subscription.deleted",
            "customer.subscription.paused",
        ):
            user_id = event["data"]["object"]["metadata"].get("user_id")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.tier = "free"
                    db.commit()

    return {"received": True}


@router.get("/subscription")
def get_subscription(user: User = Depends(get_current_user)) -> dict[str, str]:
    """Return current subscription tier for the authenticated user."""
    _require_billing()
    return {"tier": user.tier, "status": "active" if user.tier == "pro" else "free"}
