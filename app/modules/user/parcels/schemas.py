from datetime import datetime

from pydantic import BaseModel

from app.models.parcel import ParcelStatus


class ParcelResponse(BaseModel):
    id: int
    order_id: int
    truck_id: int | None
    weight_kg: float
    description: str | None
    status: ParcelStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
