from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.order import OrderStatus
from app.modules.admin.orders import crud
from app.modules.admin.orders.schemas import OrderCreate, OrderResponse, OrderUpdate

router = APIRouter(prefix="/orders", tags=["admin-orders"])


@router.get("/driver-workload")
def driver_workload(db: Session = Depends(get_db)):
    """Open order load per driver — used for assignment hierarchy UI."""
    return {"drivers": crud.get_driver_workload(db)}


@router.get("/", response_model=list[OrderResponse])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    status: OrderStatus | None = None,
    customer_id: int | None = None,
    driver_id: int | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_orders(
        db,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
        customer_id=customer_id,
        driver_id=driver_id,
    )


@router.post("/", response_model=OrderResponse)
def create_order(order_in: OrderCreate, db: Session = Depends(get_db)):
    return crud.create_order(db, order_in=order_in)


@router.post("/assign-unassigned")
def assign_unassigned_orders(db: Session = Depends(get_db)):
    """Assign all pending unassigned orders via least-loaded hierarchy."""
    count = crud.assign_all_unassigned_orders(db)
    return {
        "assigned": count,
        "message": f"Assigned {count} order(s) using least-loaded hierarchy",
    }


@router.put("/{order_id}/assign-driver", response_model=OrderResponse)
def assign_driver(
    order_id: int,
    driver_id: int | None = None,
    source: str = "admin",
    db: Session = Depends(get_db),
):
    """source=admin (default) = manual; source=auto = hierarchy when driver_id omitted."""
    order = crud.assign_order_driver(
        db, order_id=order_id, driver_id=driver_id, source=source
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/reassign", response_model=OrderResponse)
def reassign_order(
    order_id: int,
    to_driver_id: int,
    reason: str | None = None,
    db: Session = Depends(get_db),
):
    """Reassign order to a new driver (ops / recovery). Writes audit + notifies customer."""
    return crud.reassign_order(db, order_id, to_driver_id, reason=reason)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/{order_id}", response_model=OrderResponse)
def update_order(order_id: int, order_in: OrderUpdate, db: Session = Depends(get_db)):
    order = crud.update_order(db, order_id=order_id, order_in=order_in)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    if not crud.delete_order(db, order_id=order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}
