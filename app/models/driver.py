import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    ON_DELIVERY = "on_delivery"
    ON_LEAVE = "on_leave"
    SUSPENDED = "suspended"


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    license_number: Mapped[str] = mapped_column(String(50), unique=True)
    truck_id: Mapped[int | None] = mapped_column(ForeignKey("trucks.id"))
    status: Mapped[DriverStatus] = mapped_column(Enum(DriverStatus), default=DriverStatus.AVAILABLE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User")
    truck = relationship("Truck")
