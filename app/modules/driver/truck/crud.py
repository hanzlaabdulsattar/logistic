from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.location import record_truck_location
from app.models.driver import Driver
from app.models.truck import Truck, TruckStatus
from app.modules.driver.truck.schemas import TruckLocationUpdate, TruckStatusUpdate

# Statuses a driver may set on their assigned truck
DRIVER_ALLOWED_TRUCK_STATUSES = {
    TruckStatus.AVAILABLE,
    TruckStatus.IN_TRANSIT,
    TruckStatus.BREAKDOWN,
    TruckStatus.OFF_DUTY,
}

DRIVER_ALLOWED_LOCATION_STATUSES = {
    TruckStatus.AVAILABLE,
    TruckStatus.IN_TRANSIT,
    TruckStatus.BREAKDOWN,
}


def get_assigned_truck(db: Session, driver: Driver) -> Truck:
    if driver.truck_id is None:
        raise HTTPException(status_code=404, detail="No truck assigned to this driver")
    truck = db.query(Truck).filter(Truck.id == driver.truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Assigned truck not found")
    return truck


def get_truck_for_driver(db: Session, driver: Driver, truck_id: int) -> Truck:
    if driver.truck_id != truck_id:
        raise HTTPException(
            status_code=403,
            detail="You can only access your assigned truck",
        )
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return truck


def update_assigned_truck_status(
    db: Session, driver: Driver, truck_id: int, status_in: TruckStatusUpdate
) -> Truck:
    truck = get_truck_for_driver(db, driver, truck_id)
    if status_in.status not in DRIVER_ALLOWED_TRUCK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Driver can only set truck status to: "
                + ", ".join(s.value for s in DRIVER_ALLOWED_TRUCK_STATUSES)
            ),
        )
    truck.status = status_in.status
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return truck


def update_assigned_truck_location(
    db: Session,
    driver: Driver,
    truck_id: int,
    location: TruckLocationUpdate,
) -> Truck:
    """Ingest live GPS from the driver browser (START journey streaming)."""
    truck = get_truck_for_driver(db, driver, truck_id)
    if location.status and location.status not in DRIVER_ALLOWED_LOCATION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Location status must be one of: "
                + ", ".join(s.value for s in DRIVER_ALLOWED_LOCATION_STATUSES)
            ),
        )
    # DB + tracking_logs + Redis + pub/sub payload
    record_truck_location(
        db,
        truck,
        lat=location.lat,
        lng=location.lng,
        status=location.status,
    )
    db.refresh(truck)
    return truck