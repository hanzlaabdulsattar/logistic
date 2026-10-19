from datetime import datetime

from pydantic import BaseModel

from app.models.order import OrderStatus


class DeliveryResponse(BaseModel):
    id: int
    customer_id: int
    driver_id: int | None
    status: OrderStatus
    pickup_lat: float
    pickup_lng: float
    delivery_lat: float
    delivery_lng: float
    pickup_address: str | None
    delivery_address: str | None
    deadline: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeliveryStatusUpdate(BaseModel):
    status: OrderStatus


class IncomingOrderResponse(DeliveryResponse):
    """Job offer shown on driver dashboard before Accept/Reject."""

    is_incoming: bool = True
