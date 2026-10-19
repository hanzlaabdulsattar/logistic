from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.modules.auth.dependencies import require_driver
from app.modules.user.notifications import crud as notif_crud
from app.modules.user.notifications.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["driver-notifications"])


@router.get("/", response_model=list[NotificationResponse])
def list_driver_notifications(
    skip: int = 0,
    limit: int = 100,
    unread_only: bool = Query(default=False),
    current_user: User = Depends(require_driver),
    db: Session = Depends(get_db),
):
    """Driver inbox — fleet incident alerts, recovery asks, system messages."""
    return notif_crud.get_my_notifications(
        db,
        current_user,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_driver_notification_read(
    notification_id: int,
    current_user: User = Depends(require_driver),
    db: Session = Depends(get_db),
):
    return notif_crud.mark_notification_read(db, current_user, notification_id)
