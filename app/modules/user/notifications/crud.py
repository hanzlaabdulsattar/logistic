from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User


def get_my_notifications(
    db: Session,
    user: User,
    skip: int = 0,
    limit: int = 100,
    unread_only: bool = False,
    type_: NotificationType | None = None,
) -> list[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    if type_ is not None:
        query = query.filter(Notification.type == type_)
    return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()


def mark_notification_read(db: Session, user: User, notification_id: int) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
