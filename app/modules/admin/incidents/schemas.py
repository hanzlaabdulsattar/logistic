from datetime import datetime

from pydantic import BaseModel

from app.models.incident import IncidentStatus, IncidentType


class IncidentCreate(BaseModel):
    truck_id: int
    driver_id: int
    type: IncidentType
    description: str | None = None
    lat: float
    lng: float
    status: IncidentStatus = IncidentStatus.REPORTED


class IncidentUpdate(BaseModel):
    description: str | None = None
    lat: float | None = None
    lng: float | None = None
    status: IncidentStatus | None = None


class IncidentResolve(BaseModel):
    status: IncidentStatus = IncidentStatus.RESOLVED


class IncidentResponse(BaseModel):
    id: int
    truck_id: int
    driver_id: int
    type: IncidentType
    description: str | None
    lat: float
    lng: float
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
