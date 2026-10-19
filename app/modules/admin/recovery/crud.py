from sqlalchemy.orm import Session

from app.models.recovery_request import RecoveryRequest
from app.models.recovery_response import RecoveryResponse


def get_recovery_requests(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    incident_id: int | None = None,
    status: str | None = None,
) -> list[RecoveryRequest]:
    query = db.query(RecoveryRequest)
    if incident_id is not None:
        query = query.filter(RecoveryRequest.incident_id == incident_id)
    if status is not None:
        query = query.filter(RecoveryRequest.status == status)
    return query.offset(skip).limit(limit).all()


def get_recovery_request(db: Session, recovery_request_id: int) -> RecoveryRequest | None:
    return (
        db.query(RecoveryRequest)
        .filter(RecoveryRequest.id == recovery_request_id)
        .first()
    )


def get_recovery_responses(
    db: Session,
    recovery_request_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[RecoveryResponse]:
    query = db.query(RecoveryResponse)
    if recovery_request_id is not None:
        query = query.filter(RecoveryResponse.recovery_request_id == recovery_request_id)
    return query.offset(skip).limit(limit).all()
