from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.location import notify_nearby_drivers
from app.models.driver import Driver
from app.models.incident import Incident, IncidentStatus
from app.models.truck import Truck, TruckStatus
from app.models.user import User
from app.modules.driver.incidents.schemas import IncidentReport
from app.modules.user.notifications.service import notify_incident_to_fleet


def report_incident(
    db: Session, driver: Driver, report: IncidentReport
) -> tuple[Incident, dict]:
    """Report incident. Returns (incident, proximity_payload) for WS broadcast."""
    if driver.truck_id is None:
        raise HTTPException(status_code=400, detail="No truck assigned to this driver")
    truck = db.query(Truck).filter(Truck.id == driver.truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Assigned truck not found")

    incident = Incident(
        truck_id=truck.id,
        driver_id=driver.id,
        type=report.type,
        description=report.description,
        lat=report.lat,
        lng=report.lng,
        status=IncidentStatus.REPORTED,
    )
    db.add(incident)
    truck.status = TruckStatus.BREAKDOWN
    db.add(truck)
    db.flush()

    notify_incident_to_fleet(
        db,
        incident_id=incident.id,
        truck_id=truck.id,
        plate_number=truck.plate_number,
        incident_type=report.type.value,
        description=report.description,
        lat=report.lat,
        lng=report.lng,
        reporter_driver_id=driver.id,
        reporter_user_id=driver.user_id,
    )

    proximity_payload = notify_nearby_drivers(
        db,
        incident_id=incident.id,
        stuck_truck=truck,
        lat=report.lat,
        lng=report.lng,
        incident_type=report.type.value,
        description=report.description,
    )
    db.commit()
    db.refresh(incident)
    return incident, proximity_payload


def get_my_incidents(
    db: Session,
    driver: Driver,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> list[Incident]:
    query = db.query(Incident).filter(Incident.driver_id == driver.id)
    if status is not None:
        query = query.filter(Incident.status == status)
    return query.offset(skip).limit(limit).all()


def get_my_incident(db: Session, driver: Driver, incident_id: int) -> Incident:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.driver_id != driver.id:
        raise HTTPException(
            status_code=403,
            detail="You can only access your own incidents",
        )
    return incident


def get_fleet_incidents(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    status: str | None = None,
) -> list[Incident]:
    query = db.query(Incident)
    if status is not None:
        query = query.filter(Incident.status == status)
    return (
        query.order_by(Incident.created_at.desc())
        .offset(skip)
        .limit(max(1, min(limit, 200)))
        .all()
    )


def get_nearby_stuck_trucks(
    db: Session,
    driver: Driver,
    radius_km: float = 10.0,
) -> list[dict]:
    from app.core.location import find_trucks_within_radius

    if driver.truck_id is None:
        return []
    my_truck = db.query(Truck).filter(Truck.id == driver.truck_id).first()
    if not my_truck or my_truck.current_lat is None:
        return []
    return find_trucks_within_radius(
        db,
        lat=my_truck.current_lat,
        lng=my_truck.current_lng,
        radius_km=radius_km,
        exclude_truck_id=my_truck.id,
        only_operational=False,
    )
