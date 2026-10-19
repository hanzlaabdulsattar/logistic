from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.order import Order, OrderStatus
from app.models.parcel import Parcel, ParcelStatus
from app.modules.user.notifications.service import (
    notify_order_cancelled,
    notify_order_created,
)
from app.modules.user.orders.assignment import assign_driver_to_order
from app.modules.user.orders.enrichment import to_customer_order
from app.modules.user.orders.schemas import CustomerOrderResponse, OrderCreate

# Customer may cancel only before delivery is completed
CUSTOMER_CANCELLABLE_STATUSES = {
    OrderStatus.PENDING,
    OrderStatus.ASSIGNED,
}


def _get_order_orm(db: Session, customer: Customer, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != customer.id:
        raise HTTPException(
            status_code=403,
            detail="You can only access your own orders",
        )
    return order


def _create_default_parcel(db: Session, order: Order) -> Parcel:
    """Create a starter parcel so customers can see parcel tracking after booking."""
    weight = order.weight_kg if order.weight_kg is not None else 1.0
    parcel = Parcel(
        order_id=order.id,
        truck_id=None,
        weight_kg=weight,
        description=f"Parcel for order #{order.id}",
        status=ParcelStatus.PENDING,
    )
    db.add(parcel)
    db.flush()
    return parcel


def _apply_pricing(db: Session, order: Order, order_in: OrderCreate) -> None:
    """Validate weight/distance and store pricing snapshot on the order."""
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
    db.add(order)


def get_my_orders(
    db: Session,
    customer: Customer,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> list[CustomerOrderResponse]:
    query = db.query(Order).filter(Order.customer_id == customer.id)
    if status is not None:
        query = query.filter(Order.status == status)
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return [to_customer_order(db, o) for o in orders]


def get_my_order(db: Session, customer: Customer, order_id: int) -> CustomerOrderResponse:
    order = _get_order_orm(db, customer, order_id)
    return to_customer_order(db, order)


def create_my_order(db: Session, customer: Customer, order_in: OrderCreate) -> CustomerOrderResponse:
    data = order_in.model_dump(
        exclude={
            "priority",
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
    )
    order = Order(
        customer_id=customer.id,
        priority=order_in.priority,
        **data,
    )
    db.add(order)
    db.flush()  # assign order.id before notification

    # Validate + store pricing (weight 3–45 kg, distance ≤ 40 km, PKR 20/km)
    _apply_pricing(db, order, order_in)

    _create_default_parcel(db, order)

    # Auto-assign using hierarchy: admin-manual > available + least-loaded
    assigned = assign_driver_to_order(db, order, notify=False, source="auto")

    notify_order_created(
        db,
        order_id=order.id,
        customer_user_id=customer.user_id,
        pickup_address=order_in.pickup_address,
        delivery_address=order_in.delivery_address,
        created_by="customer",
    )
    if assigned is not None:
        from app.models.notification import NotificationType
        from app.modules.user.notifications.service import notify_user
        from app.modules.user.orders.enrichment import describe_driver_assignment

        notify_user(
            db,
            customer.user_id,
            type_=NotificationType.ORDER_UPDATE,
            title=f"Order #{order.id} driver assigned",
            message=(
                f"Your order #{order.id} has been assigned to "
                f"{describe_driver_assignment(db, assigned.id)}."
            ),
        )
    else:
        from app.models.notification import NotificationType
        from app.modules.user.notifications.service import notify_user

        notify_user(
            db,
            customer.user_id,
            type_=NotificationType.ORDER_UPDATE,
            title=f"Order #{order.id} awaiting driver",
            message=(
                f"Order #{order.id} was created. No driver is available yet — "
                f"operations will assign one shortly."
            ),
        )
    db.commit()
    db.refresh(order)
    return to_customer_order(db, order)


def cancel_my_order(db: Session, customer: Customer, order_id: int) -> CustomerOrderResponse:
    # Must use ORM Order — get_my_order returns a Pydantic response, not a DB row
    order = _get_order_orm(db, customer, order_id)
    if order.status not in CUSTOMER_CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Order cannot be cancelled when status is {order.status.value}",
        )
    order.status = OrderStatus.CANCELLED
    db.add(order)
    notify_order_cancelled(
        db,
        order_id=order.id,
        customer_user_id=customer.user_id,
    )
    # Ensure older order alerts (created/assigned/status) also leave the dashboard
    from app.modules.user.notifications.service import mark_order_notifications_read

    mark_order_notifications_read(db, order_id=order.id)
    db.commit()
    db.refresh(order)
    return to_customer_order(db, order)