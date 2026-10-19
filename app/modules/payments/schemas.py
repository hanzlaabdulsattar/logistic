from datetime import datetime

from pydantic import BaseModel, Field

from app.models.payment import PaymentMethod, PaymentStatus


class PaymentCreate(BaseModel):
    order_id: int
    amount: float | None = None
    currency: str | None = None
    method: PaymentMethod = PaymentMethod.SAFEPAY
    provider: str | None = None
    description: str | None = None
    return_url: str | None = None
    cancel_url: str | None = None
    customer_email: str | None = None
    customer_name: str | None = None
    provider_payment_id: str | None = None
    status: PaymentStatus | None = None


class SafePayCreateRequest(BaseModel):
    order_id: int
    # Ignored: the server charges the order's own pricing (kept for client compatibility)
    amount: float | None = None
    currency: str | None = "PKR"
    provider: str | None = "safepay"
    description: str | None = None
    return_url: str | None = None
    cancel_url: str | None = None
    customer_email: str | None = None
    customer_name: str | None = None


class CodCreateRequest(BaseModel):
    order_id: int
    # Ignored: the server charges the order's own pricing (kept for client compatibility)
    amount: float | None = None
    currency: str | None = "PKR"
    note: str | None = None


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    currency: str
    method: PaymentMethod
    provider: str | None
    provider_payment_id: str | None
    checkout_url: str | None
    status: PaymentStatus
    message: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SafePayCreateResponse(BaseModel):
    payment_id: int
    order_id: int
    amount: float
    currency: str
    status: str
    checkout_url: str
    provider: str
    message: str | None = None
    demo_mode: bool = False


class CodCreateResponse(BaseModel):
    payment_id: int
    order_id: int
    amount: float
    currency: str
    status: str
    method: str
    message: str
    payment: PaymentResponse


class OrderPaymentSummary(BaseModel):
    order_id: int
    order_status: str
    amount: float
    currency: str
    payment: PaymentResponse | None
    can_pay: bool


class MarkPaidRequest(BaseModel):
    """Sandbox / manual mark paid (also used when real SafePay webhook is not wired)."""

    status: PaymentStatus = PaymentStatus.PAID
    message: str | None = Field(default="Payment verified")
    provider_payment_id: str | None = None
