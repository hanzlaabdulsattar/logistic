from datetime import datetime

from pydantic import BaseModel

from app.models.driver import DriverStatus
from app.models.truck import TruckStatus


class DriverUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None
    role: str


class DriverTruckOut(BaseModel):
    id: int
    plate_number: str
    model: str
    capacity_kg: int
    current_load_kg: int
    status: TruckStatus
    current_lat: float | None
    current_lng: float | None

    model_config = {"from_attributes": True}


class DriverProfileResponse(BaseModel):
    id: int
    user_id: int
    license_number: str
    truck_id: int | None
    status: DriverStatus
    user: DriverUserOut
    truck: DriverTruckOut | None
    created_at: datetime
    updated_at: datetime


class DriverStatusUpdate(BaseModel):
    status: DriverStatus
