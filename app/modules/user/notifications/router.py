from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.notification import NotificationType
from app.models.user import User
from app.modules.auth.dependencies import require_customer
from app.modules.user.notifications import crud
from app.modules.user.notifications.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["user-notifications"])


@router.get("/", response_model=list[NotificationResponse])
def list_my_notifications(
    skip: int = 0,
    limit: int = 100,
    unread_only: bool = Query(default=False),
    type: NotificationType | None = None,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    return crud.get_my_notifications(
        db,
        current_user,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
        type_=type,
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(require_customer),
    db: Session = Depends(get_db),
):
    return crud.mark_notification_read(db, current_user, notification_id)
