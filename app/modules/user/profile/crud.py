from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.user import User
from app.modules.user.profile.schemas import ProfileUpdate


def update_profile(
    db: Session,
    customer: Customer,
    user: User,
    profile_in: ProfileUpdate,
) -> Customer:
    data = profile_in.model_dump(exclude_unset=True)
    if "address" in data:
        customer.address = data["address"]
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"]
    if "phone" in data:
        user.phone = data["phone"]
    db.add(customer)
    db.add(user)
    db.commit()
    db.refresh(customer)
    db.refresh(user)
    return customer


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()
