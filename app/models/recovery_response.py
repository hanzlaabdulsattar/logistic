import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecoveryResponseStatus(str, enum.Enum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class RecoveryResponse(Base):
    __tablename__ = "recovery_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    recovery_request_id: Mapped[int] = mapped_column(ForeignKey("recovery_requests.id"))
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    status: Mapped[RecoveryResponseStatus] = mapped_column(Enum(RecoveryResponseStatus))
    responded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recovery_request = relationship("RecoveryRequest")
    driver = relationship("Driver")
