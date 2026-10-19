from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.user import User
from app.modules.admin.customers.schemas import CustomerCreate, CustomerUpdate


def get_customers(db: Session, skip: int = 0, limit: int = 100) -> list[Customer]:
    return db.query(Customer).offset(skip).limit(limit).all()


def get_customer(db: Session, customer_id: int) -> Customer | None:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def create_customer(db: Session, customer_in: CustomerCreate) -> Customer:
    user = db.query(User).filter(User.id == customer_in.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(Customer).filter(Customer.user_id == customer_in.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Customer already exists for this user")
    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(db: Session, customer_id: int, customer_in: CustomerUpdate) -> Customer | None:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None
    for field, value in customer_in.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer_id: int) -> bool:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return False
    db.delete(customer)
    db.commit()
    return True
