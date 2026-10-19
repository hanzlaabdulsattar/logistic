from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.recovery_request import RecoveryRequestStatus
from app.modules.admin.recovery import crud
from app.modules.admin.recovery.schemas import RecoveryRequestResponse, RecoveryResponseItem

router = APIRouter(prefix="/recovery", tags=["admin-recovery"])


@router.get("/requests", response_model=list[RecoveryRequestResponse])
def list_recovery_requests(
    skip: int = 0,
    limit: int = 100,
    incident_id: int | None = None,
    status: RecoveryRequestStatus | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_recovery_requests(
        db,
        skip=skip,
        limit=limit,
        incident_id=incident_id,
        status=status.value if status else None,
    )


@router.get("/requests/{request_id}", response_model=RecoveryRequestResponse)
def get_recovery_request(request_id: int, db: Session = Depends(get_db)):
    request = crud.get_recovery_request(db, recovery_request_id=request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Recovery request not found")
    return request


@router.get("/responses", response_model=list[RecoveryResponseItem])
def list_recovery_responses(
    request_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return crud.get_recovery_responses(
        db, recovery_request_id=request_id, skip=skip, limit=limit
    )
