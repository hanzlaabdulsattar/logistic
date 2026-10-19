from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LocationPoint(BaseModel):
    id: int
    truck_id: int
    lat: float
    lng: float
    timestamp: datetime


class LiveTruckLocation(BaseModel):
    truck_id: int
    plate_number: str | None = None
    model: str | None = None
    lat: float
    lng: float
    status: str | None = None
    updated_at: str | None = None
