from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.driver import Driver
from app.models.recovery_request import RecoveryRequestStatus
from app.modules.auth.dependencies import get_current_driver_profile
from app.modules.driver.recovery import crud
from app.modules.driver.recovery.schemas import RecoveryRequestOut

router = APIRouter(prefix="/recovery", tags=["driver-recovery"])


@router.get("/requests", response_model=list[RecoveryRequestOut])
def list_my_recovery_requests(
    skip: int = 0,
    limit: int = 100,
    status: RecoveryRequestStatus | None = None,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_recovery_requests(
        db,
        driver,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
    )


@router.post("/requests/{request_id}/accept", response_model=RecoveryRequestOut)
def accept_recovery_request(
    request_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.accept_recovery_request(db, driver, request_id)


@router.post("/requests/{request_id}/reject", response_model=RecoveryRequestOut)
def reject_recovery_request(
    request_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.reject_recovery_request(db, driver, request_id)
