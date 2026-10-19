from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.truck import Truck
from app.models.vehicle_maintenance import VehicleMaintenance
from app.modules.admin.maintenance.schemas import MaintenanceCreate, MaintenanceUpdate


def get_maintenance_records(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    truck_id: int | None = None,
    status: str | None = None,
) -> list[VehicleMaintenance]:
    query = db.query(VehicleMaintenance)
    if truck_id is not None:
        query = query.filter(VehicleMaintenance.truck_id == truck_id)
    if status is not None:
        query = query.filter(VehicleMaintenance.status == status)
    return query.offset(skip).limit(limit).all()


def get_maintenance_record(db: Session, record_id: int) -> VehicleMaintenance | None:
    return db.query(VehicleMaintenance).filter(VehicleMaintenance.id == record_id).first()


def create_maintenance_record(
    db: Session, record_in: MaintenanceCreate
) -> VehicleMaintenance:
    truck = db.query(Truck).filter(Truck.id == record_in.truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    record = VehicleMaintenance(**record_in.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_maintenance_record(
    db: Session, record_id: int, record_in: MaintenanceUpdate
) -> VehicleMaintenance | None:
    record = db.query(VehicleMaintenance).filter(VehicleMaintenance.id == record_id).first()
    if not record:
        return None
    for field, value in record_in.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


def delete_maintenance_record(db: Session, record_id: int) -> bool:
    record = db.query(VehicleMaintenance).filter(VehicleMaintenance.id == record_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
