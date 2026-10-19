import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecoveryRequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class RecoveryRequest(Base):
    __tablename__ = "recovery_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"))
    source_truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    target_truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    target_driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    status: Mapped[RecoveryRequestStatus] = mapped_column(
        Enum(RecoveryRequestStatus), default=RecoveryRequestStatus.PENDING
    )
    distance_km: Mapped[float | None] = mapped_column(Float)
    free_space_kg: Mapped[int | None] = mapped_column()
    ai_reasoning: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    incident = relationship("Incident")
    source_truck = relationship("Truck", foreign_keys=[source_truck_id])
    target_truck = relationship("Truck", foreign_keys=[target_truck_id])
    target_driver = relationship("Driver")
