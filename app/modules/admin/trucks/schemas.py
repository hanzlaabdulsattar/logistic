from datetime import datetime

from pydantic import BaseModel

from app.models.truck import TruckStatus


class TruckCreate(BaseModel):
    plate_number: str
    model: str
    capacity_kg: int


class TruckUpdate(BaseModel):
    model: str | None = None
    capacity_kg: int | None = None
    status: TruckStatus | None = None


class TruckResponse(BaseModel):
    id: int
    plate_number: str
    model: str
    capacity_kg: int
    current_load_kg: int
    status: TruckStatus
    current_lat: float | None
    current_lng: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
