from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.driver import DriverStatus
from app.modules.admin.drivers import crud
from app.modules.admin.drivers.schemas import DriverCreate, DriverResponse, DriverUpdate

router = APIRouter(prefix="/drivers", tags=["admin-drivers"])


@router.get("/", response_model=list[DriverResponse])
def list_drivers(
    skip: int = 0,
    limit: int = 100,
    status: DriverStatus | None = None,
    truck_id: int | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_drivers(
        db,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
        truck_id=truck_id,
    )


@router.post("/", response_model=DriverResponse)
def create_driver(driver_in: DriverCreate, db: Session = Depends(get_db)):
    return crud.create_driver(db, driver_in=driver_in)


@router.get("/{driver_id}", response_model=DriverResponse)
def get_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = crud.get_driver(db, driver_id=driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.put("/{driver_id}", response_model=DriverResponse)
def update_driver(driver_id: int, driver_in: DriverUpdate, db: Session = Depends(get_db)):
    driver = crud.update_driver(db, driver_id=driver_id, driver_in=driver_in)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.delete("/{driver_id}")
def delete_driver(driver_id: int, db: Session = Depends(get_db)):
    if not crud.delete_driver(db, driver_id=driver_id):
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Driver deleted successfully"}
