from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.driver import Driver, DriverStatus
from app.models.user import User, UserRole
from app.modules.auth.dependencies import hash_password
from app.modules.auth.schemas import UserCreate


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def _ensure_driver_profile(db: Session, user: User) -> Driver | None:
    existing = db.query(Driver).filter(Driver.user_id == user.id).first()
    if existing:
        return existing
    # Unique license derived from user id
    license_number = f"DL-{user.id:04d}-{user.email.split('@')[0][:8].upper()}"
    # Avoid unique collision
    if db.query(Driver).filter(Driver.license_number == license_number).first():
        license_number = f"DL-{user.id:04d}-{user.email[:12].replace('@', '').upper()}"
    driver = Driver(
        user_id=user.id,
        license_number=license_number,
        truck_id=None,
        status=DriverStatus.AVAILABLE,
    )
    db.add(driver)
    db.flush()
    return driver


def _ensure_customer_profile(db: Session, user: User) -> Customer:
    existing = db.query(Customer).filter(Customer.user_id == user.id).first()
    if existing:
        return existing
    customer = Customer(user_id=user.id, address=None)
    db.add(customer)
    db.flush()
    return customer


def create_user(db: Session, user_in: UserCreate) -> User:
    """Create user + role profile so orders can reach them immediately.

    - customer role → Customer profile (order create/tracking works)
    - driver role → Driver profile (incoming orders / accept-reject work)
    """
    user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        role=user_in.role,
    )
    db.add(user)
    db.flush()

    if user.role == UserRole.CUSTOMER:
        _ensure_customer_profile(db, user)
    elif user.role == UserRole.DRIVER:
        _ensure_driver_profile(db, user)

    db.commit()
    db.refresh(user)
    return user
