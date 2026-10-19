from datetime import datetime

from pydantic import BaseModel

from app.models.order import OrderPriority, OrderStatus


class OrderCreate(BaseModel):
    customer_id: int
    pickup_lat: float
    pickup_lng: float
    delivery_lat: float
    delivery_lng: float
    pickup_address: str | None = None
    delivery_address: str | None = None
    deadline: datetime | None = None
    priority: OrderPriority = OrderPriority.NORMAL
    driver_id: int | None = None
    weight_kg: float | None = None
    amount: float | None = None
    currency: str | None = None
    distance_km: float | None = None
    rate_per_km: float | None = None
    rate_per_kg: float | None = None
    base_fee: float | None = None
    handling_fee: float | None = None
    pricing_formula: str | None = None
    fragile: bool | None = None


class OrderUpdate(BaseModel):
    driver_id: int | None = None
    status: OrderStatus | None = None
    priority: OrderPriority | None = None
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    delivery_lat: float | None = None
    delivery_lng: float | None = None
    pickup_address: str | None = None
    delivery_address: str | None = None
    deadline: datetime | None = None
    weight_kg: float | None = None
    amount: float | None = None
    currency: str | None = None
    distance_km: float | None = None
    rate_per_km: float | None = None
    rate_per_kg: float | None = None
    base_fee: float | None = None
    handling_fee: float | None = None
    pricing_formula: str | None = None


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    driver_id: int | None
    status: OrderStatus
    priority: OrderPriority = OrderPriority.NORMAL
    pickup_lat: float
    pickup_lng: float
    delivery_lat: float
    delivery_lng: float
    pickup_address: str | None
    delivery_address: str | None
    deadline: datetime | None
    weight_kg: float | None = None
    distance_km: float | None = None
    rate_per_km: float | None = None
    rate_per_kg: float | None = None
    base_fee: float | None = None
    handling_fee: float | None = None
    amount: float | None = None
    currency: str | None = None
    pricing_formula: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
