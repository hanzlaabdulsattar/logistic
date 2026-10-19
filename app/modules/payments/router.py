import json
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.modules.auth.dependencies import get_current_user
from app.modules.payments import service
from app.modules.payments.schemas import (
    CodCreateRequest,
    CodCreateResponse,
    MarkPaidRequest,
    OrderPaymentSummary,
    PaymentResponse,
    SafePayCreateRequest,
    SafePayCreateResponse,
)

router = APIRouter(prefix="/payments", tags=["payments"])


def _payment_out(payment) -> PaymentResponse:
    return PaymentResponse.model_validate(payment)


def _summary_out(summary: dict) -> OrderPaymentSummary:
    payment = summary.get("payment")
    return OrderPaymentSummary(
        order_id=summary["order_id"],
        order_status=summary["order_status"],
        amount=summary["amount"],
        currency=summary["currency"],
        payment=_payment_out(payment) if payment else None,
        can_pay=summary["can_pay"],
    )


async def _request_params(request: Request) -> dict[str, str]:
    """Merge query string with a form or JSON body (SafePay POSTs the redirect)."""
    params = dict(request.query_params)
    if request.method == "POST":
        raw = await request.body()
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = json.loads(raw or b"{}")
                if isinstance(body, dict):
                    params.update({k: str(v) for k, v in body.items() if v is not None})
            except json.JSONDecodeError:
                pass
        else:
            for key, values in parse_qs(raw.decode(errors="ignore")).items():
                if values:
                    params[key] = values[0]
    return params


# ---------------------------------------------------------- SafePay callbacks
# Called by SafePay / the customer's browser, so no JWT here; they are
# authenticated by the HMAC signatures instead.


@router.api_route("/safepay/return", methods=["GET", "POST"], include_in_schema=False)
async def safepay_return(request: Request, db: Session = Depends(get_db)):
    params = await _request_params(request)
    frontend = service.safe_frontend_base(params.get("frontend"))
    try:
        payment_id = int(params.get("payment_id", ""))
    except ValueError:
        return RedirectResponse(f"{frontend}/customer/payments", status_code=303)
    payment = service.confirm_safepay_return(
        db,
        payment_id=payment_id,
        tracker=params.get("tracker"),
        sig=params.get("sig"),
        reference=params.get("reference"),
    )
    return RedirectResponse(service.result_page_url(frontend, payment), status_code=303)


@router.api_route("/safepay/cancel", methods=["GET", "POST"], include_in_schema=False)
async def safepay_cancel(request: Request):
    # Leave the payment pending: the customer can retry or switch to COD.
    params = await _request_params(request)
    frontend = service.safe_frontend_base(params.get("frontend"))
    order_id = params.get("order_id", "")
    payment_id = params.get("payment_id", "")
    return RedirectResponse(
        f"{frontend}/customer/payments/result?payment_id={payment_id}"
        f"&order_id={order_id}&status=cancelled&method=safepay",
        status_code=303,
    )


@router.post("/safepay/webhook", include_in_schema=False)
async def safepay_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        body = json.loads(await request.body())
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    if not service.handle_safepay_webhook(db, body, request.headers.get("x-sfpy-signature")):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    return {"ok": True}


# ---------------------------------------------------------- customer / admin API


@router.post("/safe-pay", response_model=SafePayCreateResponse)
def create_safe_pay(
    payload: SafePayCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a SafePay checkout for an order; the frontend redirects to checkout_url.

    The amount always comes from the order's server-side pricing.
    """
    payment = service.create_safepay_payment(
        db,
        user=user,
        order_id=payload.order_id,
        description=payload.description,
        return_url=payload.return_url,
    )
    return SafePayCreateResponse(
        payment_id=payment.id,
        order_id=payment.order_id,
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status.value,
        checkout_url=payment.checkout_url or "",
        provider=payment.provider or "safepay",
        message=payment.message,
        demo_mode=not settings.safepay_live,
    )


@router.post("/cod", response_model=CodCreateResponse)
def create_cod(
    payload: CodCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Record Cash on Delivery for an order (marked paid when the driver delivers)."""
    payment = service.create_cod_payment(db, user=user, order_id=payload.order_id, note=payload.note)
    return CodCreateResponse(
        payment_id=payment.id,
        order_id=payment.order_id,
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status.value,
        method="cod",
        message=payment.message or "Cash on Delivery confirmed",
        payment=_payment_out(payment),
    )


@router.get("/order/{order_id}", response_model=OrderPaymentSummary)
def order_payment(
    order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return _summary_out(service.order_payment_summary(db, user=user, order_id=order_id))


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return _payment_out(service.get_payment_for_user(db, payment_id, user))


@router.post("/{payment_id}/mark-paid", response_model=PaymentResponse)
def mark_paid(
    payment_id: int,
    payload: MarkPaidRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Admin: set any payment status. Customer: complete own checkout in demo mode only."""
    payment = service.update_payment_status(
        db,
        user=user,
        payment_id=payment_id,
        status=payload.status,
        message=payload.message,
        provider_payment_id=payload.provider_payment_id,
    )
    return _payment_out(payment)


# Mounted at /orders/{order_id}/payment for the React client
orders_payment_router = APIRouter(tags=["payments"])


@orders_payment_router.get("/orders/{order_id}/payment", response_model=OrderPaymentSummary)
def order_payment_path(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _summary_out(service.order_payment_summary(db, user=user, order_id=order_id))
