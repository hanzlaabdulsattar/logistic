from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.truck import Truck
from app.models.user import User
from app.modules.admin.drivers.schemas import DriverCreate, DriverUpdate


def get_drivers(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    truck_id: int | None = None,
) -> list[Driver]:
    query = db.query(Driver)
    if status is not None:
        query = query.filter(Driver.status == status)
    if truck_id is not None:
        query = query.filter(Driver.truck_id == truck_id)
    return query.offset(skip).limit(limit).all()


def get_driver(db: Session, driver_id: int) -> Driver | None:
    return db.query(Driver).filter(Driver.id == driver_id).first()


def create_driver(db: Session, driver_in: DriverCreate) -> Driver:
    user = db.query(User).filter(User.id == driver_in.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(Driver).filter(Driver.user_id == driver_in.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Driver already exists for this user")
    existing_license = (
        db.query(Driver).filter(Driver.license_number == driver_in.license_number).first()
    )
    if existing_license:
        raise HTTPException(status_code=400, detail="License number already exists")
    if driver_in.truck_id is not None:
        truck = db.query(Truck).filter(Truck.id == driver_in.truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truck not found")
    driver = Driver(**driver_in.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def update_driver(db: Session, driver_id: int, driver_in: DriverUpdate) -> Driver | None:
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        return None
    data = driver_in.model_dump(exclude_unset=True)
    if data.get("truck_id") is not None:
        truck = db.query(Truck).filter(Truck.id == data["truck_id"]).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truck not found")
    for field, value in data.items():
        setattr(driver, field, value)
    db.commit()
    db.refresh(driver)
    return driver


def delete_driver(db: Session, driver_id: int) -> bool:
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        return False
    db.delete(driver)
    db.commit()
    return True
