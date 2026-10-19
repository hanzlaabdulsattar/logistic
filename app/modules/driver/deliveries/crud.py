from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.driver import Driver, DriverStatus
from app.models.notification import NotificationType
from app.models.order import Order, OrderStatus
from app.models.parcel import Parcel
from app.modules.driver.deliveries.schemas import DeliveryStatusUpdate
from app.modules.user.notifications.service import notify_user
from app.modules.user.orders.assignment import assign_driver_to_order
from app.modules.user.orders.enrichment import describe_driver_assignment

# Statuses a driver may set on their own deliveries after accepting
DRIVER_ALLOWED_DELIVERY_STATUSES = {
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
}

# Job offer on driver dashboard (not yet accepted)
INCOMING_STATUSES = {OrderStatus.PENDING}


def get_my_deliveries(
    db: Session,
    driver: Driver,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> list[Order]:
    query = db.query(Order).filter(Order.driver_id == driver.id)
    if status is not None:
        query = query.filter(Order.status == status)
    # Incoming offers first, then accepted work, newest first
    return query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()


def get_incoming_orders(db: Session, driver: Driver) -> list[Order]:
    """Orders offered to this driver that still need Accept/Reject."""
    return (
        db.query(Order)
        .filter(Order.driver_id == driver.id, Order.status == OrderStatus.PENDING)
        .order_by(Order.created_at.desc())
        .all()
    )


def get_accepted_deliveries(db: Session, driver: Driver) -> list[Order]:
    """Orders the driver already accepted (assigned / in transit / delivered)."""
    return (
        db.query(Order)
        .filter(
            Order.driver_id == driver.id,
            Order.status.in_(
                [OrderStatus.ASSIGNED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]
            ),
        )
        .order_by(Order.created_at.desc())
        .all()
    )


def get_my_delivery(db: Session, driver: Driver, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if order.driver_id != driver.id:
        raise HTTPException(
            status_code=403,
            detail="You can only access your own deliveries",
        )
    return order


def _notify_customer_order_event(
    db: Session,
    order: Order,
    *,
    title: str,
    message: str,
) -> None:
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if not customer:
        return
    notify_user(
        db,
        customer.user_id,
        type_=NotificationType.ORDER_UPDATE,
        title=title,
        message=message,
    )


def accept_order(db: Session, driver: Driver, order_id: int) -> Order:
    """Driver accepts an incoming job offer."""
    order = get_my_delivery(db, driver, order_id)
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Order is already {order.status.value} — only pending offers can be accepted",
        )

    order.status = OrderStatus.ASSIGNED
    db.add(order)

    # Driver can accept multiple jobs; mark on_delivery only when they start transit
    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.ON_DELIVERY
        db.add(driver)

    if order.driver_id:
        parcels = db.query(Parcel).filter(Parcel.order_id == order.id).all()
        for p in parcels:
            if p.truck_id is None and driver.truck_id:
                p.truck_id = driver.truck_id
                db.add(p)

    _notify_customer_order_event(
        db,
        order,
        title=f"Order #{order.id} accepted",
        message=(
            f"Driver {describe_driver_assignment(db, driver.id)} accepted your order "
            f"#{order.id}. Status is now assigned."
        ),
    )
    db.commit()
    db.refresh(order)
    return order


def reject_order(db: Session, driver: Driver, order_id: int) -> Order:
    """Driver rejects an incoming job offer — order goes back for reassignment."""
    order = get_my_delivery(db, driver, order_id)
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Order is already {order.status.value} — only pending offers can be rejected",
        )

    order.driver_id = None
    order.status = OrderStatus.PENDING
    db.add(order)
    db.flush()

    # Offer to another available driver using least-loaded hierarchy (never rejector)
    reassigned = assign_driver_to_order(
        db,
        order,
        notify=True,
        status=OrderStatus.PENDING,
        exclude_driver_ids={driver.id},
        source="auto",
    )
    if reassigned is None:
        _notify_customer_order_event(
            db,
            order,
            title=f"Order #{order.id} awaiting driver",
            message=(
                f"Order #{order.id} was rejected by a driver. "
                f"No other driver is available yet — operations will reassign."
            ),
        )

    db.commit()
    db.refresh(order)
    return order


def update_my_delivery_status(
    db: Session, driver: Driver, order_id: int, status_in: DeliveryStatusUpdate
) -> Order:
    order = get_my_delivery(db, driver, order_id)
    if status_in.status == OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Use accept/reject for pending offers",
        )
    if status_in.status not in DRIVER_ALLOWED_DELIVERY_STATUSES and status_in.status != OrderStatus.ASSIGNED:
        allowed = ", ".join(s.value for s in DRIVER_ALLOWED_DELIVERY_STATUSES)
        raise HTTPException(
            status_code=400,
            detail=f"Driver can only set delivery status to: {allowed}",
        )
    if order.status == OrderStatus.DELIVERED and status_in.status != OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=400,
            detail="Delivered orders cannot change status",
        )
    if order.status == OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Accept the order before changing delivery status",
        )
    previous = order.status
    order.status = status_in.status
    db.add(order)

    if order.status == OrderStatus.IN_TRANSIT and driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.ON_DELIVERY
        db.add(driver)

    if order.status == OrderStatus.DELIVERED and driver.status == DriverStatus.ON_DELIVERY:
        # Only free driver if they have no other active deliveries
        active = (
            db.query(Order)
            .filter(
                Order.driver_id == driver.id,
                Order.id != order.id,
                Order.status.in_(
                    [OrderStatus.ASSIGNED, OrderStatus.IN_TRANSIT]
                ),
            )
            .count()
        )
        if active == 0:
            driver.status = DriverStatus.AVAILABLE
            db.add(driver)

    if previous != order.status:
        if order.status == OrderStatus.DELIVERED:
            from app.modules.payments.service import settle_cod_on_delivery

            settle_cod_on_delivery(db, order)
            _notify_customer_order_event(
                db,
                order,
                title=f"Order #{order.id} delivered",
                message=(
                    f"Good news! Your order #{order.id} has been delivered by "
                    f"{describe_driver_assignment(db, driver.id)}."
                ),
            )
        else:
            _notify_customer_order_event(
                db,
                order,
                title=f"Order #{order.id} status update",
                message=f"Order #{order.id} is now {order.status.value.replace('_', ' ')}.",
            )
    db.commit()
    db.refresh(order)
    return order
