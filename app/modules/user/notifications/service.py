"""Shared notification helpers for order/customer/incident events."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole


def notify_user(
    db: Session,
    user_id: int | None,
    *,
    type_: NotificationType,
    title: str,
    message: str,
) -> Notification | None:
    """Create a notification for a user. Returns None if user_id is missing."""
    if not user_id:
        return None
    notification = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notification)
    return notification


def notify_all_drivers(
    db: Session,
    *,
    type_: NotificationType,
    title: str,
    message: str,
    exclude_user_id: int | None = None,
) -> int:
    """Broadcast a message to every driver user (and admins for ops visibility)."""
    users = (
        db.query(User)
        .filter(User.role.in_([UserRole.DRIVER, UserRole.ADMIN]), User.is_active.is_(True))
        .all()
    )
    count = 0
    for user in users:
        if exclude_user_id is not None and user.id == exclude_user_id:
            continue
        notify_user(
            db,
            user.id,
            type_=type_,
            title=title,
            message=message,
        )
        count += 1
    return count


def notify_incident_to_fleet(
    db: Session,
    *,
    incident_id: int,
    truck_id: int,
    plate_number: str | None,
    incident_type: str,
    description: str | None,
    lat: float,
    lng: float,
    reporter_driver_id: int,
    reporter_user_id: int | None,
) -> int:
    """When any driver reports an incident, alert every other driver + admin."""
    desc = (description or "").strip()
    title = f"Fleet alert: Incident #{incident_id} · Truck #{truck_id}"
    message = (
        f"A driver reported {incident_type} on truck #{truck_id}"
        + (f" ({plate_number})" if plate_number else "")
        + f" at ({lat:.5f}, {lng:.5f})."
    )
    if desc:
        message += f" Details: {desc}"
    message += " Nearby drivers: stay alert; admin may request recovery assist."
    return notify_all_drivers(
        db,
        type_=NotificationType.INCIDENT_ALERT,
        title=title,
        message=message,
        exclude_user_id=reporter_user_id,
    )


def notify_order_created(
    db: Session,
    *,
    order_id: int,
    customer_user_id: int | None,
    pickup_address: str | None,
    delivery_address: str | None,
    created_by: str = "customer",
) -> Notification | None:
    """Notify the customer that their order has been created."""
    pickup = pickup_address or "pickup location"
    delivery = delivery_address or "delivery location"
    title = f"Order #{order_id} created"
    message = (
        f"Your order has been created successfully. "
        f"Route: {pickup} → {delivery}. "
        f"Status: pending. "
        f"You can see who is assigned under My Orders once operations assign a driver."
    )
    return notify_user(
        db,
        customer_user_id,
        type_=NotificationType.ORDER_UPDATE,
        title=title,
        message=message,
    )


def notify_order_cancelled(
    db: Session,
    *,
    order_id: int,
    customer_user_id: int | None,
) -> Notification | None:
    """Notify cancel, then mark all notifications for this order as read
    so they disappear from the customer dashboard unread list."""
    notification = notify_user(
        db,
        customer_user_id,
        type_=NotificationType.ORDER_UPDATE,
        title=f"Order #{order_id} cancelled",
        message=(
            f"Order #{order_id} has been cancelled. "
            f"It is hidden from your active dashboard. "
            f"You can review it under My Orders → filter cancelled."
        ),
    )
    # Cancel notice itself should not stay unread on the dashboard
    if notification is not None:
        notification.is_read = True
        db.add(notification)
    db.flush()
    mark_order_notifications_read(db, order_id=order_id)
    return notification


def mark_order_notifications_read(db: Session, *, order_id: int) -> int:
    """Mark every notification that references this order as read.

    Used when an order is cancelled so create/assign/status/cancel alerts
    no longer appear on the customer dashboard.
    """
    from sqlalchemy import or_

    needles = (f"Order #{order_id}", f"order #{order_id}")
    filters: list = []
    for needle in needles:
        filters.append(Notification.title.contains(needle))
        filters.append(Notification.message.contains(needle))
    notifications = db.query(Notification).filter(or_(*filters)).all()
    updated = 0
    for n in notifications:
        if not n.is_read:
            n.is_read = True
            db.add(n)
            updated += 1
    return updated
