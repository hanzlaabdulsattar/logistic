from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.recovery_request import RecoveryRequest, RecoveryRequestStatus
from app.models.recovery_response import RecoveryResponse, RecoveryResponseStatus


def get_my_recovery_requests(
    db: Session,
    driver: Driver,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> list[RecoveryRequest]:
    query = db.query(RecoveryRequest).filter(RecoveryRequest.target_driver_id == driver.id)
    if status is not None:
        query = query.filter(RecoveryRequest.status == status)
    return query.offset(skip).limit(limit).all()


def _get_pending_request_for_driver(
    db: Session, driver: Driver, request_id: int
) -> RecoveryRequest:
    request = db.query(RecoveryRequest).filter(RecoveryRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Recovery request not found")
    if request.target_driver_id != driver.id:
        raise HTTPException(
            status_code=403,
            detail="This recovery request was not assigned to you",
        )
    if request.status != RecoveryRequestStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Recovery request is already {request.status.value}",
        )
    return request


def accept_recovery_request(db: Session, driver: Driver, request_id: int) -> RecoveryRequest:
    request = _get_pending_request_for_driver(db, driver, request_id)
    request.status = RecoveryRequestStatus.ACCEPTED
    response = RecoveryResponse(
        recovery_request_id=request.id,
        driver_id=driver.id,
        status=RecoveryResponseStatus.ACCEPTED,
    )
    db.add(request)
    db.add(response)
    db.commit()
    db.refresh(request)
    return request


def reject_recovery_request(db: Session, driver: Driver, request_id: int) -> RecoveryRequest:
    request = _get_pending_request_for_driver(db, driver, request_id)
    request.status = RecoveryRequestStatus.REJECTED
    response = RecoveryResponse(
        recovery_request_id=request.id,
        driver_id=driver.id,
        status=RecoveryResponseStatus.REJECTED,
    )
    db.add(request)
    db.add(response)
    db.commit()
    db.refresh(request)
    return request
