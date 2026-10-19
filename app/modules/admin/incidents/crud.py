from __future__ import annotations

import asyncio
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.location import notify_nearby_drivers
from app.models.driver import Driver
from app.models.incident import Incident, IncidentStatus
from app.models.truck import Truck, TruckStatus
from app.models.user import User
from app.modules.admin.incidents.schemas import IncidentCreate, IncidentResolve, IncidentUpdate
from app.modules.user.notifications.service import notify_incident_to_fleet


def get_incidents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    truck_id: int | None = None,
    driver_id: int | None = None,
) -> list[Incident]:
    query = db.query(Incident)
    if status is not None:
        query = query.filter(Incident.status == status)
    if truck_id is not None:
        query = query.filter(Incident.truck_id == truck_id)
    if driver_id is not None:
        query = query.filter(Incident.driver_id == driver_id)
    return query.offset(skip).limit(limit).all()


def get_incident(db: Session, incident_id: int) -> Incident | None:
    return db.query(Incident).filter(Incident.id == incident_id).first()


def create_incident(db: Session, incident_in: IncidentCreate) -> tuple[Incident, dict]:
    truck = db.query(Truck).filter(Truck.id == incident_in.truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    driver = db.query(Driver).filter(Driver.id == incident_in.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    incident = Incident(**incident_in.model_dump())
    db.add(incident)
    if incident_in.status == IncidentStatus.REPORTED and truck.status != TruckStatus.BREAKDOWN:
        truck.status = TruckStatus.BREAKDOWN
    db.flush()
    notify_incident_to_fleet(
        db,
        incident_id=incident.id,
        truck_id=truck.id,
        plate_number=truck.plate_number,
        incident_type=incident_in.type.value,
        description=incident_in.description,
        lat=incident_in.lat,
        lng=incident_in.lng,
        reporter_driver_id=driver.id,
        reporter_user_id=driver.user_id,
    )
    proximity_payload = notify_nearby_drivers(
        db,
        incident_id=incident.id,
        stuck_truck=truck,
        lat=incident_in.lat,
        lng=incident_in.lng,
        incident_type=incident_in.type.value,
        description=incident_in.description,
    )
    db.commit()
    db.refresh(incident)
    return incident, proximity_payload


def update_incident(db: Session, incident_id: int, incident_in: IncidentUpdate) -> Incident | None:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return None
    for field, value in incident_in.model_dump(exclude_unset=True).items():
        setattr(incident, field, value)
    db.commit()
    db.refresh(incident)
    return incident


def resolve_incident(db: Session, incident_id: int, resolve_in: IncidentResolve) -> Incident | None:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return None
    incident.status = resolve_in.status
    db.commit()
    db.refresh(incident)
    return incident


def delete_incident(db: Session, incident_id: int) -> bool:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return False
    db.delete(incident)
    db.commit()
    return True
