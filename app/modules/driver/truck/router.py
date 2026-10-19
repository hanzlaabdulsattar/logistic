from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.driver import Driver
from app.modules.auth.dependencies import get_current_driver_profile
from app.modules.driver.truck import crud
from app.modules.driver.truck.schemas import (
    TruckLocationUpdate,
    TruckOut,
    TruckStatusUpdate,
)

router = APIRouter(prefix="/trucks", tags=["driver-truck"])


@router.get("/my", response_model=TruckOut)
def get_my_truck(
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_assigned_truck(db, driver)


@router.get("/{truck_id}", response_model=TruckOut)
def get_truck(
    truck_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_truck_for_driver(db, driver, truck_id)


@router.patch("/{truck_id}/status", response_model=TruckOut)
def update_truck_status(
    truck_id: int,
    status_in: TruckStatusUpdate,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.update_assigned_truck_status(db, driver, truck_id, status_in)


@router.post("/{truck_id}/location", response_model=TruckOut)
def update_truck_location(
    truck_id: int,
    location: TruckLocationUpdate,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    """Driver app streams GPS here after START; customers see it on the map."""
    return crud.update_assigned_truck_location(db, driver, truck_id, location)