from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.order import Order, OrderStatus
from app.models.truck import Truck, TruckStatus
from app.models.user import User
from app.modules.user.orders.schemas import CustomerOrderResponse


def driver_assignment_fields(db: Session, driver_id: int | None) -> dict:
    """Resolve driver name/license/phone and assigned truck for an order."""
    empty = {
        "driver_name": None,
        "driver_phone": None,
        "driver_license": None,
        "truck_plate": None,
        "truck_model": None,
        "truck_id": None,
        "truck_lat": None,
        "truck_lng": None,
        "truck_status": None,
        "truck_location_updated_at": None,
        # journey_phase is set separately in to_customer_order — do not put it here
    }
    if not driver_id:
        return empty
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        return empty
    user = db.query(User).filter(User.id == driver.user_id).first()
    truck = None
    if driver.truck_id:
        truck = db.query(Truck).filter(Truck.id == driver.truck_id).first()
    return {
        "driver_name": user.full_name if user else None,
        "driver_phone": user.phone if user else None,
        "driver_license": driver.license_number,
        "truck_plate": truck.plate_number if truck else None,
        "truck_model": truck.model if truck else None,
        "truck_id": truck.id if truck else None,
        "truck_lat": truck.current_lat if truck else None,
        "truck_lng": truck.current_lng if truck else None,
        "truck_status": truck.status.value if truck else None,
        "truck_location_updated_at": truck.updated_at if truck else None,
    }


def journey_phase(order: Order, truck_status: str | None) -> str:
    """Customer-facing journey phase from order + truck status."""
    if order.status == OrderStatus.DELIVERED:
        return "delivered"
    if order.status == OrderStatus.CANCELLED:
        return "cancelled"
    if order.status == OrderStatus.PENDING:
        return "awaiting_accept"
    if order.status == OrderStatus.ASSIGNED and truck_status in {
        TruckStatus.IN_TRANSIT.value,
        "in_transit",
    }:
        return "on_the_way"
    if order.status == OrderStatus.ASSIGNED and truck_status in {
        TruckStatus.AVAILABLE.value,
        "available",
        None,
    }:
        return "stopped"
    if order.status == OrderStatus.IN_TRANSIT and truck_status in {
        TruckStatus.IN_TRANSIT.value,
        "in_transit",
    }:
        return "on_the_way"
    if order.status == OrderStatus.IN_TRANSIT:
        return "stopped"
    if order.status == OrderStatus.REASSIGNED:
        return "reassigned"
    return order.status.value


def describe_driver_assignment(db: Session, driver_id: int | None) -> str:
    """Human-readable driver assignment for notifications."""
    if not driver_id:
        return "not assigned"
    info = driver_assignment_fields(db, driver_id)
    name = info.get("driver_name") or f"Driver #{driver_id}"
    license_ = info.get("driver_license")
    plate = info.get("truck_plate")
    parts = [name]
    if license_:
        parts.append(f"License {license_}")
    if plate:
        parts.append(f"Truck {plate}")
    return " · ".join(parts)


def to_customer_order(db: Session, order: Order) -> CustomerOrderResponse:
    extra = dict(driver_assignment_fields(db, order.driver_id))
    # Never pass journey_phase twice — strip it if present in extra
    extra.pop("journey_phase", None)
    phase = journey_phase(order, extra.get("truck_status"))
    return CustomerOrderResponse(
        id=order.id,
        customer_id=order.customer_id,
        driver_id=order.driver_id,
        status=order.status,
        priority=getattr(order, "priority", None) or "normal",
        pickup_lat=order.pickup_lat,
        pickup_lng=order.pickup_lng,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        pickup_address=order.pickup_address,
        delivery_address=order.delivery_address,
        deadline=order.deadline,
        weight_kg=getattr(order, "weight_kg", None),
        distance_km=getattr(order, "distance_km", None),
        rate_per_km=getattr(order, "rate_per_km", None),
        rate_per_kg=getattr(order, "rate_per_kg", None),
        base_fee=getattr(order, "base_fee", None),
        handling_fee=getattr(order, "handling_fee", None),
        amount=getattr(order, "amount", None),
        currency=getattr(order, "currency", None),
        pricing_formula=getattr(order, "pricing_formula", None),
        created_at=order.created_at,
        updated_at=order.updated_at,
        **extra,
        journey_phase=phase,
    )