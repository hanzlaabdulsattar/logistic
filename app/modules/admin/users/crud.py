from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.modules.admin.users.schemas import UserUpdate


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> list[User]:
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def update_user(db: Session, user_id: int, user_in: UserUpdate) -> User | None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    for field, value in user_in.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
