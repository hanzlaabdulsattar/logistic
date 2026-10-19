from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.location import broadcast_stuck_alert
from app.models.incident import IncidentStatus
from app.modules.admin.incidents import crud
from app.modules.admin.incidents.schemas import (
    IncidentCreate,
    IncidentResolve,
    IncidentResponse,
    IncidentUpdate,
)

router = APIRouter(prefix="/incidents", tags=["admin-incidents"])


@router.get("/", response_model=list[IncidentResponse])
def list_incidents(
    skip: int = 0,
    limit: int = 100,
    status: IncidentStatus | None = None,
    truck_id: int | None = None,
    driver_id: int | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_incidents(
        db,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
        truck_id=truck_id,
        driver_id=driver_id,
    )


@router.post("/", response_model=IncidentResponse)
async def create_incident(incident_in: IncidentCreate, db: Session = Depends(get_db)):
    incident, proximity_payload = crud.create_incident(db, incident_in=incident_in)
    await broadcast_stuck_alert(proximity_payload)
    return incident


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = crud.get_incident(db, incident_id=incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: int, incident_in: IncidentUpdate, db: Session = Depends(get_db)):
    incident = crud.update_incident(db, incident_id=incident_id, incident_in=incident_in)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(incident_id: int, resolve_in: IncidentResolve, db: Session = Depends(get_db)):
    incident = crud.resolve_incident(db, incident_id=incident_id, resolve_in=resolve_in)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.delete("/{incident_id}")
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    if not crud.delete_incident(db, incident_id=incident_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"message": "Incident deleted successfully"}
