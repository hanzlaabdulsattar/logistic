from datetime import datetime

from pydantic import BaseModel

from app.models.driver import DriverStatus


class DriverCreate(BaseModel):
    user_id: int
    license_number: str
    truck_id: int | None = None


class DriverUpdate(BaseModel):
    license_number: str | None = None
    truck_id: int | None = None
    status: DriverStatus | None = None


class DriverResponse(BaseModel):
    id: int
    user_id: int
    license_number: str
    truck_id: int | None
    status: DriverStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
