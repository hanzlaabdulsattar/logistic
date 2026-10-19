"""Payment services: SafePay checkout + Cash on Delivery.

Live mode (SAFEPAY_PUBLIC_KEY + SAFEPAY_SECRET_KEY set):
  create tracker on SafePay → redirect customer to SafePay hosted checkout →
  SafePay POSTs back to /payments/safepay/return with a signed tracker →
  payment is marked paid only after the HMAC signature is verified.
  Webhooks (/payments/safepay/webhook) confirm payments as a second channel.

Demo mode (no real keys): checkout_url points to the local sandbox checkout
page, which completes the payment via POST /payments/{id}/mark-paid.

The charged amount always comes from the order's server-side pricing,
never from the client.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote, urlencode, urlparse

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User, UserRole
from app.modules.payments import safepay

OPEN_PAYMENT_STATUSES = (PaymentStatus.PENDING, PaymentStatus.PROCESSING)
DEMO_COMPLETION_STATUSES = (PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED)


# ----------------------------------------------------------------- helpers


def _customer_user_id(db: Session, order: Order) -> int | None:
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    return customer.user_id if customer else None


def get_order_for_user(db: Session, order_id: int, user: User) -> Order:
    """Admins see every order; customers only their own (404 otherwise)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.role != UserRole.ADMIN and _customer_user_id(db, order) != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def get_payment_for_user(db: Session, payment_id: int, user: User) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if user.role != UserRole.ADMIN and payment.customer_user_id != user.id:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


def _paid_payment(db: Session, order_id: int) -> Payment | None:
    return (
        db.query(Payment)
        .filter(Payment.order_id == order_id, Payment.status == PaymentStatus.PAID)
        .first()
    )


def _ensure_payable(db: Session, order: Order) -> None:
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled order cannot be paid")
    if _paid_payment(db, order.id):
        raise HTTPException(status_code=409, detail=f"Order #{order.id} is already paid")


def _order_amount(order: Order) -> float:
    """Amount from the order's stored pricing; recomputed if missing (legacy orders)."""
    if order.amount is not None and order.amount > 0:
        return float(order.amount)
    from app.modules.user.orders.pricing import compute_pricing

    pricing = compute_pricing(
        pickup_lat=order.pickup_lat,
        pickup_lng=order.pickup_lng,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        weight_kg=order.weight_kg,
    )
    order.amount = pricing.amount
    order.currency = pricing.currency
    order.distance_km = pricing.distance_km
    order.rate_per_km = pricing.rate_per_km
    order.pricing_formula = pricing.pricing_formula
    return pricing.amount


def _order_currency(order: Order) -> str:
    return (order.currency or "PKR").upper()


def safe_frontend_base(candidate: str | None) -> str:
    """Origin of a client-supplied URL if trusted, else FRONTEND_BASE_URL (no open redirect)."""
    default = settings.frontend_base_url.rstrip("/")
    if not candidate:
        return default
    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return default
    origin = f"{parsed.scheme}://{parsed.netloc}"
    trusted = {o for o in settings.cors_origin_list if o != "*"} | {default}
    if origin in trusted or parsed.hostname in ("localhost", "127.0.0.1"):
        return origin
    return default


def result_page_url(frontend: str, payment: Payment) -> str:
    query = urlencode(
        {
            "payment_id": payment.id,
            "order_id": payment.order_id,
            "status": payment.status.value,
            "method": payment.method.value,
        }
    )
    return f"{frontend}/customer/payments/result?{query}"


def _set_paid(db: Session, payment: Payment, *, message: str) -> None:
    payment.status = PaymentStatus.PAID
    payment.message = message
    db.add(payment)


# ----------------------------------------------------------------- SafePay


def create_safepay_payment(
    db: Session,
    *,
    user: User,
    order_id: int,
    description: str | None,
    return_url: str | None,
) -> Payment:
    order = get_order_for_user(db, order_id, user)
    _ensure_payable(db, order)
    amount = _order_amount(order)
    currency = _order_currency(order)

    payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order.id,
            Payment.method == PaymentMethod.SAFEPAY,
            Payment.status.in_(OPEN_PAYMENT_STATUSES),
        )
        .first()
    )
    if payment is None:
        payment = Payment(
            order_id=order.id,
            customer_user_id=_customer_user_id(db, order),
            method=PaymentMethod.SAFEPAY,
            provider="safepay",
        )
        db.add(payment)
    payment.amount = amount
    payment.currency = currency
    payment.status = PaymentStatus.PENDING
    payment.description = (
        description
        or f"Delivery order #{order.id} ({order.pickup_address or 'pickup'} → "
        f"{order.delivery_address or 'delivery'})"
    )[:500]
    db.flush()  # payment.id is needed for the return URLs

    frontend = safe_frontend_base(return_url)
    if settings.safepay_live:
        # Fresh tracker each attempt so amount changes / expired sessions never leak through
        tracker = safepay.create_tracker(amount, currency)
        api = settings.api_base_url.rstrip("/")
        back = urlencode(
            {"payment_id": payment.id, "order_id": order.id, "frontend": frontend}
        )
        payment.provider_payment_id = tracker
        payment.checkout_url = safepay.build_checkout_url(
            tracker=tracker,
            order_ref=f"order-{order.id}-payment-{payment.id}",
            redirect_url=f"{api}/payments/safepay/return?{back}",
            cancel_url=f"{api}/payments/safepay/cancel?{back}",
        )
        payment.message = f"SafePay checkout created ({settings.safepay_env})."
    else:
        payment.provider_payment_id = None
        payment.checkout_url = (
            f"{frontend}/customer/payments/checkout"
            f"?payment_id={payment.id}&order_id={order.id}"
            f"&amount={amount}&currency={quote(currency)}&demo=1"
        )
        payment.message = (
            "Demo mode: SafePay keys are not configured, using the local sandbox checkout."
        )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def confirm_safepay_return(
    db: Session, *, payment_id: int, tracker: str | None, sig: str | None, reference: str | None
) -> Payment:
    """Verify SafePay's signed redirect and mark the payment paid."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.method != PaymentMethod.SAFEPAY:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == PaymentStatus.PAID:
        return payment
    if (
        payment.provider_payment_id
        and tracker == payment.provider_payment_id
        and safepay.verify_redirect_signature(tracker, sig)
    ):
        ref = f" Ref {reference}." if reference else ""
        _set_paid(db, payment, message=f"SafePay payment verified.{ref}")
    else:
        payment.status = PaymentStatus.FAILED
        payment.message = "SafePay return could not be verified (invalid signature)."
        db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def handle_safepay_webhook(db: Session, body: dict[str, Any], signature: str | None) -> bool:
    """Process a SafePay webhook. Returns False if the signature is invalid."""
    data = body.get("data")
    if data is None or not safepay.verify_webhook(data, signature):
        return False
    notification = data.get("notification") or {}
    tracker = notification.get("tracker") or data.get("tracker")
    event = str(data.get("type") or body.get("type") or "")
    state = str(notification.get("state") or "").upper()
    if not tracker:
        return True
    payment = db.query(Payment).filter(Payment.provider_payment_id == tracker).first()
    if not payment:
        return True
    if event == "payment:created" or state in ("PAID", "TRACKER_ENDED"):
        if payment.status != PaymentStatus.PAID:
            ref = notification.get("reference")
            _set_paid(
                db, payment, message=f"SafePay webhook confirmed payment.{f' Ref {ref}.' if ref else ''}"
            )
    elif "refund" in event:
        payment.status = PaymentStatus.REFUNDED
        payment.message = "Refunded via SafePay."
        db.add(payment)
    db.commit()
    return True


# ----------------------------------------------------------------- COD


def create_cod_payment(db: Session, *, user: User, order_id: int, note: str | None) -> Payment:
    order = get_order_for_user(db, order_id, user)
    _ensure_payable(db, order)
    amount = _order_amount(order)

    payment = (
        db.query(Payment)
        .filter(Payment.order_id == order.id, Payment.method == PaymentMethod.COD)
        .order_by(Payment.id.desc())
        .first()
    )
    if payment is None:
        payment = Payment(
            order_id=order.id,
            customer_user_id=_customer_user_id(db, order),
            method=PaymentMethod.COD,
            provider="cash_on_delivery",
            description=f"Cash on Delivery for order #{order.id}",
        )
    payment.amount = amount
    payment.currency = _order_currency(order)
    payment.status = PaymentStatus.PENDING
    payment.message = (note or "Cash on Delivery confirmed — pay driver on delivery")[:500]
    db.add(payment)

    # Switching to COD abandons any open online checkout for this order
    db.query(Payment).filter(
        Payment.order_id == order.id,
        Payment.method == PaymentMethod.SAFEPAY,
        Payment.status.in_(OPEN_PAYMENT_STATUSES),
    ).update({Payment.status: PaymentStatus.CANCELLED}, synchronize_session=False)

    db.commit()
    db.refresh(payment)
    return payment


def settle_cod_on_delivery(db: Session, order: Order) -> None:
    """Driver delivered the order → the cash was collected. Caller commits."""
    payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order.id,
            Payment.method == PaymentMethod.COD,
            Payment.status == PaymentStatus.PENDING,
        )
        .first()
    )
    if payment:
        _set_paid(db, payment, message="Cash collected by driver on delivery")


# ----------------------------------------------------------------- status updates


def update_payment_status(
    db: Session,
    *,
    user: User,
    payment_id: int,
    status: PaymentStatus,
    message: str | None,
    provider_payment_id: str | None,
) -> Payment:
    """Admin: set any status. Customer: finish own demo checkout only."""
    payment = get_payment_for_user(db, payment_id, user)

    if user.role != UserRole.ADMIN:
        if settings.safepay_live:
            raise HTTPException(
                status_code=403,
                detail="Payments are confirmed by SafePay, not by the client",
            )
        if payment.method != PaymentMethod.SAFEPAY:
            raise HTTPException(status_code=403, detail="Only SafePay demo payments can be completed")
        if payment.status not in OPEN_PAYMENT_STATUSES:
            raise HTTPException(
                status_code=409, detail=f"Payment is already {payment.status.value}"
            )
        if status not in DEMO_COMPLETION_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status for demo checkout")
        if status == PaymentStatus.PAID and _paid_payment(db, payment.order_id):
            raise HTTPException(status_code=409, detail="Order is already paid")

    payment.status = status
    if message:
        payment.message = message[:500]
    if provider_payment_id and user.role == UserRole.ADMIN:
        payment.provider_payment_id = provider_payment_id
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


# ----------------------------------------------------------------- summary


def order_payment_summary(db: Session, *, user: User, order_id: int) -> dict:
    order = get_order_for_user(db, order_id, user)
    paid = _paid_payment(db, order.id)
    payment = paid or (
        db.query(Payment)
        .filter(Payment.order_id == order.id)
        .order_by(Payment.id.desc())
        .first()
    )
    amount = (
        float(order.amount)
        if order.amount
        else (float(payment.amount) if payment else 0.0)
    )
    return {
        "order_id": order.id,
        "order_status": order.status.value,
        "amount": amount,
        "currency": _order_currency(order),
        "payment": payment,
        "can_pay": order.status != OrderStatus.CANCELLED and paid is None,
    }
