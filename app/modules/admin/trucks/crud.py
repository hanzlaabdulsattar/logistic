from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.truck import Truck
from app.modules.admin.trucks.schemas import TruckCreate, TruckUpdate


def get_trucks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> list[Truck]:
    query = db.query(Truck)
    if status is not None:
        query = query.filter(Truck.status == status)
    return query.offset(skip).limit(limit).all()


def get_truck(db: Session, truck_id: int) -> Truck | None:
    return db.query(Truck).filter(Truck.id == truck_id).first()


def create_truck(db: Session, truck_in: TruckCreate) -> Truck:
    existing = db.query(Truck).filter(Truck.plate_number == truck_in.plate_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plate number already exists")
    truck = Truck(**truck_in.model_dump())
    db.add(truck)
    db.commit()
    db.refresh(truck)
    return truck


def update_truck(db: Session, truck_id: int, truck_in: TruckUpdate) -> Truck | None:
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        return None
    for field, value in truck_in.model_dump(exclude_unset=True).items():
        setattr(truck, field, value)
    db.commit()
    db.refresh(truck)
    return truck


def delete_truck(db: Session, truck_id: int) -> bool:
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        return False
    db.delete(truck)
    db.commit()
    return True
