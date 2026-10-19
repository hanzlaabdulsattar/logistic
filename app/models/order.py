import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REASSIGNED = "reassigned"


class OrderPriority(str, enum.Enum):
    """Higher number = more urgent. Used when bulk-assigning many orders."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

    @property
    def rank(self) -> int:
        return {"low": 0, "normal": 1, "high": 2, "urgent": 3}[self.value]


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)
    priority: Mapped[OrderPriority] = mapped_column(
        Enum(
            OrderPriority,
            name="orderpriority",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=OrderPriority.NORMAL,
    )
    pickup_lat: Mapped[float] = mapped_column(Float)
    pickup_lng: Mapped[float] = mapped_column(Float)
    delivery_lat: Mapped[float] = mapped_column(Float)
    delivery_lng: Mapped[float] = mapped_column(Float)
    pickup_address: Mapped[str | None] = mapped_column(String(500))
    delivery_address: Mapped[str | None] = mapped_column(String(500))
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Dynamic pricing snapshot stored with each order
    weight_kg: Mapped[float | None] = mapped_column(Float, default=None)
    distance_km: Mapped[float | None] = mapped_column(Float, default=None)
    rate_per_km: Mapped[float | None] = mapped_column(Float, default=None)
    rate_per_kg: Mapped[float | None] = mapped_column(Float, default=None)
    base_fee: Mapped[float | None] = mapped_column(Float, default=None)
    handling_fee: Mapped[float | None] = mapped_column(Float, default=None)
    amount: Mapped[float | None] = mapped_column(Float, default=None)
    currency: Mapped[str | None] = mapped_column(String(10), default=None)
    pricing_formula: Mapped[str | None] = mapped_column(String(500), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer = relationship("Customer")
    driver = relationship("Driver")