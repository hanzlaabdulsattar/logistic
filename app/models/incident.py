import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class IncidentType(str, enum.Enum):
    BREAKDOWN = "breakdown"
    ACCIDENT = "accident"
    FLAT_TIRE = "flat_tire"
    ENGINE_FAILURE = "engine_failure"
    OTHER = "other"


class IncidentStatus(str, enum.Enum):
    REPORTED = "reported"
    RECOVERY_IN_PROGRESS = "recovery_in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    type: Mapped[IncidentType] = mapped_column(Enum(IncidentType))
    description: Mapped[str | None] = mapped_column(String(1000))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), default=IncidentStatus.REPORTED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    truck = relationship("Truck")
    driver = relationship("Driver")
