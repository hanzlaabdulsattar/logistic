from datetime import datetime

from pydantic import BaseModel

from app.models.vehicle_maintenance import MaintenanceStatus, MaintenanceType


class MaintenanceCreate(BaseModel):
    truck_id: int
    type: MaintenanceType
    description: str | None = None
    scheduled_at: datetime | None = None


class MaintenanceUpdate(BaseModel):
    description: str | None = None
    status: MaintenanceStatus | None = None
    scheduled_at: datetime | None = None
    completed_at: datetime | None = None


class MaintenanceResponse(BaseModel):
    id: int
    truck_id: int
    type: MaintenanceType
    description: str | None
    status: MaintenanceStatus
    scheduled_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
