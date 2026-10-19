from datetime import datetime

from pydantic import BaseModel, Field


class TruckOut(BaseModel):
    id: int
    plate_number: str
    model: str
    capacity_kg: int
    current_load_kg: int
    status: str
    current_lat: float | None
    current_lng: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TruckStatusUpdate(BaseModel):
    status: str


class TruckLocationUpdate(BaseModel):
    """Browser Geolocation coordinates from the driver app."""

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    # Optional: mark journey active/inactive while streaming GPS
    status: str | None = None
