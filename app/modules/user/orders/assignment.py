"""Order → driver assignment hierarchy.

Rules (in order):
1) Admin manual assignment always wins when driver_id is set explicitly.
2) Auto-assign (customer create, bulk assign, driver reject):
   a. Only AVAILABLE or ON_DELIVERY drivers
   b. Prefer AVAILABLE over ON_DELIVERY
   c. Prefer drivers that already have a truck
   d. Among those → least loaded (fewest open orders)
   e. Tie-break → lower driver id
3) If no eligible driver → order stays unassigned for admin.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.driver import Driver, DriverStatus
from app.models.notification import NotificationType
from app.models.order import Order, OrderStatus
from app.models.parcel import Parcel
from app.modules.user.notifications.service import notify_user
from app.modules.user.orders.enrichment import describe_driver_assignment

# Statuses that count as "open work" for load balancing
OPEN_ORDER_STATUSES = (
    OrderStatus.PENDING,
    OrderStatus.ASSIGNED,
    OrderStatus.IN_TRANSIT,
)


def driver_load_map(db: Session) -> dict[int, int]:
    """Open order count per driver id."""
    rows = (
        db.query(Order.driver_id, Order.id)
        .filter(
            Order.driver_id.isnot(None),
            Order.status.in_(OPEN_ORDER_STATUSES),
        )
        .all()
    )
    loads: dict[int, int] = {}
    for driver_id, _order_id in rows:
        loads[driver_id] = loads.get(driver_id, 0) + 1
    return loads


def pick_available_driver(
    db: Session,
    exclude_ids: set[int] | None = None,
) -> Driver | None:
    """Pick next driver using the assignment hierarchy (least-loaded auto)."""
    exclude_ids = exclude_ids or set()
    loads = driver_load_map(db)

    query = db.query(Driver).filter(
        Driver.status.in_([DriverStatus.AVAILABLE, DriverStatus.ON_DELIVERY])
    )
    if exclude_ids:
        query = query.filter(~Driver.id.in_(exclude_ids))

    candidates = query.all()
    if not candidates:
        return None

    def sort_key(d: Driver) -> tuple:
        load = loads.get(d.id, 0)
        has_truck = 0 if d.truck_id else 1  # prefer truck first
        status_rank = 0 if d.status == DriverStatus.AVAILABLE else 1
        return (status_rank, has_truck, load, d.id)

    candidates.sort(key=sort_key)
    return candidates[0]


def explain_assignment(
    db: Session,
    *,
    driver_id: int | None,
    source: str,
) -> str:
    """Human-readable assignment reason for admin UI / logs."""
    if driver_id is None:
        return "Unassigned — no eligible driver (admin must assign)."
    if source == "admin":
        return f"Admin manual assignment → driver #{driver_id}."
    load = driver_load_map(db).get(driver_id, 0)
    return (
        f"Auto hierarchy → driver #{driver_id} "
        f"(status truck preferred, least-loaded first; open jobs before this order: {load})."
    )


def assign_driver_to_order(
    db: Session,
    order: Order,
    *,
    driver: Driver | None = None,
    notify: bool = True,
    status: OrderStatus = OrderStatus.PENDING,
    exclude_driver_ids: set[int] | None = None,
    source: str = "auto",
) -> Driver | None:
    """Offer an order to a driver (pending = waiting for Accept).

    Pass driver=... for admin manual assignment.
    Leave driver=None for auto hierarchy (least-loaded).
    """
    target = driver or pick_available_driver(db, exclude_ids=exclude_driver_ids)
    if target is None:
        return None

    order.driver_id = target.id
    order.status = status
    db.add(order)

    if target.truck_id:
        parcels = db.query(Parcel).filter(Parcel.order_id == order.id).all()
        for p in parcels:
            if p.truck_id is None:
                p.truck_id = target.truck_id
                db.add(p)

    if notify:
        customer_user_id = None
        from app.models.customer import Customer

        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            customer_user_id = customer.user_id
        if status == OrderStatus.PENDING:
            message = (
                f"Your order #{order.id} is offered to "
                f"{describe_driver_assignment(db, target.id)}. "
                f"Waiting for the driver to accept."
            )
        else:
            message = (
                f"Your order #{order.id} has been assigned to "
                f"{describe_driver_assignment(db, target.id)}."
            )
        notify_user(
            db,
            customer_user_id,
            type_=NotificationType.ORDER_UPDATE,
            title=f"Order #{order.id} driver assigned",
            message=message,
        )
    db.flush()
    return target
