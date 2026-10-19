from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OrderReassignment(Base):
    __tablename__ = "order_reassignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    from_driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    to_driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order")
    from_driver = relationship("Driver", foreign_keys=[from_driver_id])
    to_driver = relationship("Driver", foreign_keys=[to_driver_id])
