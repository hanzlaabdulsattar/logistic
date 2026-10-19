from fastapi import HTTPException
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.driver import Driver
from app.models.notification import NotificationType
from app.models.order import Order, OrderPriority, OrderStatus
from app.models.order_reassignment import OrderReassignment
from app.models.parcel import Parcel, ParcelStatus
from app.modules.admin.orders.schemas import OrderCreate, OrderUpdate
from app.modules.user.notifications.service import (
    notify_order_cancelled,
    notify_order_created,
    notify_user,
)
from app.modules.user.orders.assignment import (
    assign_driver_to_order,
    driver_load_map,
    explain_assignment,
    pick_available_driver,
)
from app.modules.user.orders.enrichment import describe_driver_assignment


def get_orders(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    customer_id: int | None = None,
    driver_id: int | None = None,
) -> list[Order]:
    query = db.query(Order)
    if status is not None:
        query = query.filter(Order.status == status)
    if customer_id is not None:
        query = query.filter(Order.customer_id == customer_id)
    if driver_id is not None:
        query = query.filter(Order.driver_id == driver_id)
    return query.offset(skip).limit(limit).all()


def assign_order_driver(
    db: Session,
    order_id: int,
    driver_id: int | None,
    *,
    source: str = "admin",
) -> Order | None:
    """Assign (or clear) a driver on an order and notify the customer.

    source='admin'  → manual pick (highest priority)
    source='auto'   → use least-loaded hierarchy when driver_id is None
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    if driver_id is not None:
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        assign_driver_to_order(
            db,
            order,
            driver=driver,
            notify=False,
            source=source,
        )
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            notify_user(
                db,
                customer.user_id,
                type_=NotificationType.ORDER_UPDATE,
                title=f"Order #{order.id} driver assigned",
                message=(
                    f"Your order #{order.id} has been assigned to "
                    f"{describe_driver_assignment(db, driver.id)}. "
                    f"({explain_assignment(db, driver_id=driver.id, source=source)})"
                ),
            )
    else:
        # Explicit clear, or auto-reassign when source=auto and no driver given
        if source == "auto":
            assigned = assign_driver_to_order(
                db,
                order,
                driver=None,
                notify=True,
                source="auto",
            )
            if assigned is None:
                order.driver_id = None
                order.status = OrderStatus.PENDING
                db.add(order)
        else:
            order.driver_id = None
            if order.status == OrderStatus.ASSIGNED:
                order.status = OrderStatus.PENDING
            db.add(order)
    db.commit()
    db.refresh(order)
    return order


def assign_all_unassigned_orders(db: Session) -> int:
    """Bulk-assign pending unassigned orders using hierarchy + priority.

    Order of assignment: urgent → high → normal → low, then oldest first.
    Within each priority: least-loaded available driver.
    """
    from app.models.order import OrderPriority

    orders = (
        db.query(Order)
        .filter(Order.driver_id.is_(None), Order.status == OrderStatus.PENDING)
        .all()
    )

    def order_key(o: Order):
        try:
            pr = o.priority if isinstance(o.priority, OrderPriority) else OrderPriority(o.priority)
            rank = pr.rank
        except Exception:
            rank = OrderPriority.NORMAL.rank
        return (-rank, o.created_at or datetime.min, o.id)

    from datetime import datetime

    orders.sort(key=order_key)

    count = 0
    for order in orders:
        if (
            assign_driver_to_order(
                db,
                order,
                notify=True,
                status=OrderStatus.PENDING,
                source="auto",
            )
            is not None
        ):
            count += 1
    db.commit()
    return count


def reassign_order(
    db: Session,
    order_id: int,
    to_driver_id: int,
    *,
    reason: str | None = None,
) -> Order:
    """Move an order to a new driver (recovery / ops reassignment).

    Writes OrderReassignment audit row + notifies the customer.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Delivered orders cannot be reassigned")
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled orders cannot be reassigned")

    to_driver = db.query(Driver).filter(Driver.id == to_driver_id).first()
    if not to_driver:
        raise HTTPException(status_code=404, detail="Target driver not found")

    from_driver_id = order.driver_id
    audit = OrderReassignment(
        order_id=order.id,
        from_driver_id=from_driver_id if from_driver_id is not None else to_driver_id,
        to_driver_id=to_driver_id,
        reason=reason or "Admin reassignment",
    )
    db.add(audit)

    # Offer to new driver (pending) unless order already in transit — keep in_transit if it was
    keep_transit = order.status == OrderStatus.IN_TRANSIT
    assign_driver_to_order(
        db,
        order,
        driver=to_driver,
        notify=False,
        status=OrderStatus.IN_TRANSIT if keep_transit else OrderStatus.PENDING,
        source="admin",
    )

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if customer:
        notify_user(
            db,
            customer.user_id,
            type_=NotificationType.ORDER_UPDATE,
            title=f"Order #{order.id} reassigned",
            message=(
                f"Your order #{order.id} was reassigned to "
                f"{describe_driver_assignment(db, to_driver_id)}."
                + (f" Reason: {reason}" if reason else "")
            ),
        )
    db.commit()
    db.refresh(order)
    return order


def get_driver_workload(db: Session) -> list[dict]:
    """Admin helper: open order load per driver for assignment UI."""
    loads = driver_load_map(db)
    drivers = db.query(Driver).all()
    rows = []
    for d in drivers:
        user = None
        if d.user_id:
            from app.models.user import User

            user = db.query(User).filter(User.id == d.user_id).first()
        rows.append(
            {
                "driver_id": d.id,
                "name": user.full_name if user else f"Driver #{d.id}",
                "email": user.email if user else None,
                "status": d.status.value,
                "truck_id": d.truck_id,
                "open_orders": loads.get(d.id, 0),
            }
        )
    rows.sort(key=lambda r: (r["status"] != "available", r["open_orders"], r["driver_id"]))
    return rows


def get_order(db: Session, order_id: int) -> Order | None:
    return db.query(Order).filter(Order.id == order_id).first()


def _apply_order_pricing(order: Order, order_in: OrderCreate) -> None:
    from app.modules.user.orders.pricing import compute_pricing

    pricing = compute_pricing(
        pickup_lat=order.pickup_lat,
        pickup_lng=order.pickup_lng,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        weight_kg=order_in.weight_kg,
        amount=order_in.amount,
        rate_per_km=order_in.rate_per_km,
    )
    order.weight_kg = pricing.weight_kg
    order.distance_km = pricing.distance_km
    order.rate_per_km = pricing.rate_per_km
    order.rate_per_kg = pricing.rate_per_kg
    order.base_fee = pricing.base_fee
    order.handling_fee = pricing.handling_fee
    order.amount = pricing.amount
    order.currency = pricing.currency
    order.pricing_formula = pricing.pricing_formula
    db_add = order
    # caller adds to session


def create_order(db: Session, order_in: OrderCreate) -> Order:
    customer = db.query(Customer).filter(Customer.id == order_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    pricing_fields = {
        "weight_kg",
        "amount",
        "currency",
        "distance_km",
        "rate_per_km",
        "rate_per_kg",
        "base_fee",
        "handling_fee",
        "pricing_formula",
        "fragile",
    }
    data = order_in.model_dump(exclude=pricing_fields)
    order = Order(**data)
    db.add(order)
    db.flush()

    # Validate + store pricing snapshot on order
    _apply_order_pricing(order, order_in)

    db.add(
        Parcel(
            order_id=order.id,
            truck_id=None,
            weight_kg=order.weight_kg or 3.0,
            description=f"Parcel for order #{order.id}",
            status=ParcelStatus.PENDING,
        )
    )
    db.flush()

    # If admin didn't pick a driver, auto-assign an available one
    if order.driver_id is None:
        assign_driver_to_order(db, order, notify=False, source="auto")

    notify_order_created(
        db,
        order_id=order.id,
        customer_user_id=customer.user_id,
        pickup_address=order_in.pickup_address,
        delivery_address=order_in.delivery_address,
        created_by="admin",
    )

    if order.driver_id:
        notify_user(
            db,
            customer.user_id,
            type_=NotificationType.ORDER_UPDATE,
            title=f"Order #{order.id} driver assigned",
            message=(
                f"Your order #{order.id} has been assigned to "
                f"{describe_driver_assignment(db, order.driver_id)}."
            ),
        )

    db.commit()
    db.refresh(order)
    return order


def update_order(db: Session, order_id: int, order_in: OrderUpdate) -> Order | None:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    data = order_in.model_dump(exclude_unset=True)
    if data.get("driver_id") is not None:
        driver = db.query(Driver).filter(Driver.id == data["driver_id"]).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
    previous_status = order.status
    previous_driver_id = order.driver_id
    for field, value in data.items():
        setattr(order, field, value)
    db.add(order)
    db.flush()

    # If a driver was set via update_order, ensure status/notification path is consistent
    if data.get("driver_id") is not None and data["driver_id"] != previous_driver_id:
        driver = db.query(Driver).filter(Driver.id == data["driver_id"]).first()
        if driver:
            assign_driver_to_order(db, order, driver=driver, notify=False)

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    customer_user_id = customer.user_id if customer else None

    # Driver assigned (new or changed)
    if data.get("driver_id") is not None and data["driver_id"] != previous_driver_id:
        notify_user(
            db,
            customer_user_id,
            type_=NotificationType.ORDER_UPDATE,
            title=f"Order #{order.id} driver assigned",
            message=(
                f"Your order #{order.id} has been assigned to "
                f"{describe_driver_assignment(db, order.driver_id)}."
            ),
        )
    elif data.get("status") and data["status"] != previous_status:
        status_raw = data["status"]
        status_value = getattr(status_raw, "value", status_raw)
        status_label = str(status_value).replace("_", " ")
        if status_label in {"assigned", "in transit", "in_transit"} and order.driver_id:
            notify_user(
                db,
                customer_user_id,
                type_=NotificationType.ORDER_UPDATE,
                title=f"Order #{order.id} status update",
                message=(
                    f"Order #{order.id} is now {status_label}. "
                    f"Driver: {describe_driver_assignment(db, order.driver_id)}."
                ),
            )
        else:
            notify_user(
                db,
                customer_user_id,
                type_=NotificationType.ORDER_UPDATE,
                title=f"Order #{order.id} status update",
                message=f"Order #{order.id} is now {status_label}.",
            )

    db.commit()
    db.refresh(order)
    return order


def delete_order(db: Session, order_id: int) -> bool:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return False
    db.delete(order)
    db.commit()
    return True
