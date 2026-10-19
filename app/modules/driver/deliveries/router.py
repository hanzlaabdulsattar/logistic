from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.driver import Driver
from app.models.order import OrderStatus
from app.modules.auth.dependencies import get_current_driver_profile
from app.modules.driver.deliveries import crud
from app.modules.driver.deliveries.schemas import (
    DeliveryResponse,
    DeliveryStatusUpdate,
    IncomingOrderResponse,
)

router = APIRouter(prefix="/deliveries", tags=["driver-deliveries"])


@router.get("/", response_model=list[DeliveryResponse])
def list_my_deliveries(
    skip: int = 0,
    limit: int = 100,
    status: OrderStatus | None = None,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_deliveries(
        db,
        driver,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
    )


@router.get("/incoming", response_model=list[IncomingOrderResponse])
def list_incoming_orders(
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    """Pending job offers assigned to this driver (awaiting Accept/Reject)."""
    orders = crud.get_incoming_orders(db, driver)
    return [
        IncomingOrderResponse(
            id=o.id,
            customer_id=o.customer_id,
            driver_id=o.driver_id,
            status=o.status,
            pickup_lat=o.pickup_lat,
            pickup_lng=o.pickup_lng,
            delivery_lat=o.delivery_lat,
            delivery_lng=o.delivery_lng,
            pickup_address=o.pickup_address,
            delivery_address=o.delivery_address,
            deadline=o.deadline,
            created_at=o.created_at,
            updated_at=o.updated_at,
            is_incoming=True,
        )
        for o in orders
    ]


@router.get("/accepted", response_model=list[DeliveryResponse])
def list_accepted_deliveries(
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    """Orders already accepted by this driver."""
    return crud.get_accepted_deliveries(db, driver)


@router.post("/{order_id}/accept", response_model=DeliveryResponse)
def accept_order(
    order_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.accept_order(db, driver, order_id)


@router.post("/{order_id}/reject", response_model=DeliveryResponse)
def reject_order(
    order_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.reject_order(db, driver, order_id)


@router.get("/{order_id}", response_model=DeliveryResponse)
def get_my_delivery(
    order_id: int,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_delivery(db, driver, order_id)


@router.patch("/{order_id}/status", response_model=DeliveryResponse)
def update_my_delivery_status(
    order_id: int,
    status_in: DeliveryStatusUpdate,
    driver: Driver = Depends(get_current_driver_profile),
    db: Session = Depends(get_db),
):
    return crud.update_my_delivery_status(db, driver, order_id, status_in)
