from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.driver import Driver
from app.modules.auth.dependencies import get_current_driver_profile, require_driver
from app.models.user import User
from app.modules.driver.profile import crud
from app.modules.driver.profile.schemas import (
    DriverProfileResponse,
    DriverStatusUpdate,
    DriverTruckOut,
    DriverUserOut,
)

router = APIRouter(prefix="/profile", tags=["driver-profile"])


def _profile_response(driver: Driver, db: Session) -> DriverProfileResponse:
    db.refresh(driver)
    user = crud.get_user(db, driver.user_id)
    return DriverProfileResponse(
        id=driver.id,
        user_id=driver.user_id,
        license_number=driver.license_number,
        truck_id=driver.truck_id,
        status=driver.status,
        user=DriverUserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role.value,
        )
        if user
        else None,
        truck=DriverTruckOut.model_validate(driver.truck) if driver.truck else None,
        created_at=driver.created_at,
        updated_at=driver.updated_at,
    )


@router.get("/me", response_model=DriverProfileResponse)
def get_my_profile(
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return _profile_response(driver, db)


@router.patch("/status", response_model=DriverProfileResponse)
def update_my_status(
    status_in: DriverStatusUpdate,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    driver = crud.update_driver_status(db, driver, status_in.status)
    return _profile_response(driver, db)
