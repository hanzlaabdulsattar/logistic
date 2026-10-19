from datetime import datetime

from pydantic import BaseModel

from app.models.order import OrderPriority, OrderStatus


class OrderCreate(BaseModel):
    pickup_lat: float
    pickup_lng: float
    delivery_lat: float
    delivery_lng: float
    pickup_address: str | None = None
    delivery_address: str | None = None
    deadline: datetime | None = None
    priority: OrderPriority = OrderPriority.NORMAL
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


class OrderCancel(BaseModel):
    reason: str | None = None


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


class CustomerOrderResponse(OrderResponse):
    """Customer-facing order with assigned driver + live truck location."""

    driver_name: str | None = None
    driver_phone: str | None = None
    driver_license: str | None = None
    truck_plate: str | None = None
    truck_model: str | None = None
    truck_id: int | None = None
    truck_lat: float | None = None
    truck_lng: float | None = None
    truck_status: str | None = None
    truck_location_updated_at: datetime | None = None
    # on_the_way | stopped | idle | unknown
    journey_phase: str | None = None
