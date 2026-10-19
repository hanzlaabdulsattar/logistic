from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.location import NEARBY_RADIUS_KM, broadcast_stuck_alert
from app.models.driver import Driver
from app.models.incident import IncidentStatus
from app.models.user import User
from app.modules.auth.dependencies import get_current_driver_profile, require_driver
from app.modules.driver.incidents import crud
from app.modules.driver.incidents.schemas import IncidentReport, IncidentResponse

router = APIRouter(prefix="/incidents", tags=["driver-incidents"])


class NearbyTruckOut(BaseModel):
    truck_id: int
    plate_number: str
    model: str
    status: str
    lat: float
    lng: float
    distance_km: float


@router.post("/", response_model=IncidentResponse)
async def report_incident(
    report: IncidentReport,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    """Report incident → fleet alert + 10km proximity WebSocket alert."""
    incident, proximity_payload = crud.report_incident(db, driver, report)
    await broadcast_stuck_alert(proximity_payload)
    return incident


@router.get("/", response_model=list[IncidentResponse])
def list_my_incidents(
    skip: int = 0,
    limit: int = 100,
    status: IncidentStatus | None = None,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_incidents(
        db,
        driver,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
    )


@router.get("/fleet", response_model=list[IncidentResponse])
def list_fleet_incidents(
    skip: int = 0,
    limit: int = 50,
    status: IncidentStatus | None = None,
    current_user=Depends(require_driver),
    db: Session = Depends(get_db),
):
    return crud.get_fleet_incidents(
        db,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
    )


@router.get("/nearby", response_model=list[NearbyTruckOut])
def list_nearby_trucks(
    radius_km: float = Query(default=NEARBY_RADIUS_KM, ge=0.1, le=50),
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    """Trucks within radius_km of this driver (stuck + operational)."""
    items = crud.get_nearby_stuck_trucks(db, driver, radius_km=radius_km)
    return [NearbyTruckOut(**x) for x in items]


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_my_incident(
    incident_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_incident(db, driver, incident_id)
