from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.order import Order
from app.models.parcel import Parcel


def _order_belongs_to_customer(order: Order, customer: Customer) -> bool:
    return order.customer_id == customer.id


def get_my_order_parcels(
    db: Session,
    customer: Customer,
    order_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> list[Parcel]:
    query = db.query(Parcel).join(Order, Parcel.order_id == Order.id).filter(
        Order.customer_id == customer.id
    )
    if order_id is not None:
        query = query.filter(Parcel.order_id == order_id)
    if status is not None:
        query = query.filter(Parcel.status == status)
    return query.offset(skip).limit(limit).all()


def get_my_parcel(db: Session, customer: Customer, parcel_id: int) -> Parcel:
    parcel = db.query(Parcel).filter(Parcel.id == parcel_id).first()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    order = db.query(Order).filter(Order.id == parcel.order_id).first()
    if not order or not _order_belongs_to_customer(order, customer):
        raise HTTPException(
            status_code=403,
            detail="You can only access parcels on your own orders",
        )
    return parcel
