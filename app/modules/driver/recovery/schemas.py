from datetime import datetime

from pydantic import BaseModel

from app.models.recovery_request import RecoveryRequestStatus
from app.models.recovery_response import RecoveryResponseStatus


class RecoveryRequestOut(BaseModel):
    id: int
    incident_id: int
    source_truck_id: int
    target_truck_id: int
    target_driver_id: int
    status: RecoveryRequestStatus
    distance_km: float | None
    free_space_kg: int | None
    ai_reasoning: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecoveryResponseOut(BaseModel):
    id: int
    recovery_request_id: int
    driver_id: int
    status: RecoveryResponseStatus
    responded_at: datetime

    model_config = {"from_attributes": True}


class RecoveryDecision(BaseModel):
    # placeholder for future notes; status comes from accept/reject endpoint
    note: str | None = None
