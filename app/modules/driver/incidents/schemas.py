from datetime import datetime

from pydantic import BaseModel, Field

from app.models.incident import IncidentStatus, IncidentType


class IncidentReport(BaseModel):
    type: IncidentType
    description: str | None = None
    lat: float
    lng: float


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
