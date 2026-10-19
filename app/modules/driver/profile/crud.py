from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.user import User


def get_driver_profile(db: Session, driver: Driver) -> Driver:
    db.refresh(driver)
    return driver


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def update_driver_status(db: Session, driver: Driver, status) -> Driver:
    driver.status = status
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver
