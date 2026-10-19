import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ParcelTransferStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ParcelTransfer(Base):
    __tablename__ = "parcel_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    recovery_request_id: Mapped[int] = mapped_column(ForeignKey("recovery_requests.id"))
    parcel_id: Mapped[int] = mapped_column(ForeignKey("parcels.id"))
    from_truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    to_truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    status: Mapped[ParcelTransferStatus] = mapped_column(
        Enum(ParcelTransferStatus), default=ParcelTransferStatus.PENDING
    )
    transferred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recovery_request = relationship("RecoveryRequest")
    parcel = relationship("Parcel")
    from_truck = relationship("Truck", foreign_keys=[from_truck_id])
    to_truck = relationship("Truck", foreign_keys=[to_truck_id])
