from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RouteHistory(Base):
    __tablename__ = "route_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"))
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    driver = relationship("Driver")
    truck = relationship("Truck")
    order = relationship("Order")
