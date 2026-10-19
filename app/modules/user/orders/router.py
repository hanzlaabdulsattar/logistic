from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer
from app.models.order import OrderStatus
from app.modules.auth.dependencies import get_current_customer_profile
from app.modules.user.orders import crud
from app.modules.user.orders.schemas import CustomerOrderResponse, OrderCreate

router = APIRouter(prefix="/orders", tags=["user-orders"])


@router.get("/", response_model=list[CustomerOrderResponse])
def list_my_orders(
    skip: int = 0,
    limit: int = 100,
    status: OrderStatus | None = None,
    customer: Customer = Depends(get_current_customer_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_orders(
        db,
        customer,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
    )


@router.post("/", response_model=CustomerOrderResponse)
def create_my_order(
    order_in: OrderCreate,
    customer: Customer = Depends(get_current_customer_profile),
    db: Session = Depends(get_db),
):
    return crud.create_my_order(db, customer, order_in)


@router.get("/{order_id}", response_model=CustomerOrderResponse)
def get_my_order(
    order_id: int,
    customer: Customer = Depends(get_current_customer_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_order(db, customer, order_id)


@router.post("/{order_id}/cancel", response_model=CustomerOrderResponse)
def cancel_my_order(
    order_id: int,
    customer: Customer = Depends(get_current_customer_profile),
    db: Session = Depends(get_db),
):
    return crud.cancel_my_order(db, customer, order_id)
