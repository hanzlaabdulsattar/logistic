from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.parcel import Parcel
from app.models.truck import Truck
from app.modules.admin.parcels.schemas import ParcelCreate, ParcelUpdate


def get_parcels(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    order_id: int | None = None,
    truck_id: int | None = None,
    status: str | None = None,
) -> list[Parcel]:
    query = db.query(Parcel)
    if order_id is not None:
        query = query.filter(Parcel.order_id == order_id)
    if truck_id is not None:
        query = query.filter(Parcel.truck_id == truck_id)
    if status is not None:
        query = query.filter(Parcel.status == status)
    return query.offset(skip).limit(limit).all()


def get_parcel(db: Session, parcel_id: int) -> Parcel | None:
    return db.query(Parcel).filter(Parcel.id == parcel_id).first()


def create_parcel(db: Session, parcel_in: ParcelCreate) -> Parcel:
    order = db.query(Order).filter(Order.id == parcel_in.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if parcel_in.truck_id is not None:
        truck = db.query(Truck).filter(Truck.id == parcel_in.truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truck not found")
    parcel = Parcel(**parcel_in.model_dump())
    db.add(parcel)
    db.commit()
    db.refresh(parcel)
    return parcel


def update_parcel(db: Session, parcel_id: int, parcel_in: ParcelUpdate) -> Parcel | None:
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        return None
    data = parcel_in.model_dump(exclude_unset=True)
    if data.get("truck_id") is not None:
        truck = db.query(Truck).filter(Truck.id == data["truck_id"]).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truck not found")
    for field, value in data.items():
        setattr(parcel, field, value)
    db.commit()
    db.refresh(parcel)
    return parcel


def delete_parcel(db: Session, parcel_id: int) -> bool:
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        return False
    db.delete(parcel)
    db.commit()
    return True
