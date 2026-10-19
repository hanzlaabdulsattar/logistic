"""Seed sample data for admin module testing.

Usage:
    cd /home/hanzlamayo/Desktop/logistic
    .venv/bin/python scripts/seed_admin.py
"""

from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.driver import Driver, DriverStatus
from app.models.order import Order, OrderStatus
from app.models.parcel import Parcel, ParcelStatus
from app.models.truck import Truck, TruckStatus
from app.models.user import User, UserRole
from app.modules.auth.dependencies import hash_password


def seed() -> None:
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@test.com").first():
            print("Seed data already exists. Skipping.")
            return

        admin = User(
            email="admin@test.com",
            password_hash=hash_password("admin123"),
            full_name="Admin User",
            role=UserRole.ADMIN,
        )
        driver_user = User(
            email="driver@test.com",
            password_hash=hash_password("driver123"),
            full_name="Driver One",
            role=UserRole.DRIVER,
        )
        customer_user = User(
            email="customer@test.com",
            password_hash=hash_password("customer123"),
            full_name="Customer One",
            role=UserRole.CUSTOMER,
        )
        db.add_all([admin, driver_user, customer_user])
        db.flush()

        truck1 = Truck(
            plate_number="LHR-1001",
            model="Hino 300",
            capacity_kg=10000,
            status=TruckStatus.AVAILABLE,
            current_lat=31.5204,
            current_lng=74.3587,
        )
        truck2 = Truck(
            plate_number="KHI-2002",
            model="Isuzu NPR",
            capacity_kg=8000,
            status=TruckStatus.IN_TRANSIT,
            current_lat=24.8607,
            current_lng=67.0011,
        )
        db.add_all([truck1, truck2])
        db.flush()

        driver = Driver(
            user_id=driver_user.id,
            license_number="LIC-9001",
            truck_id=truck1.id,
            status=DriverStatus.AVAILABLE,
        )
        db.add(driver)
        db.flush()

        customer = Customer(user_id=customer_user.id, address="Lahore, Pakistan")
        db.add(customer)
        db.flush()

        order = Order(
            customer_id=customer.id,
            driver_id=driver.id,
            status=OrderStatus.ASSIGNED,
            pickup_lat=31.5204,
            pickup_lng=74.3587,
            delivery_lat=33.6844,
            delivery_lng=73.0479,
            pickup_address="Lahore Warehouse",
            delivery_address="Islamabad Hub",
            deadline=datetime.now(timezone.utc) + timedelta(days=2),
        )
        db.add(order)
        db.flush()

        parcel = Parcel(
            order_id=order.id,
            truck_id=truck1.id,
            weight_kg=250.5,
            description="Electronics package",
            status=ParcelStatus.PENDING,
        )
        db.add(parcel)
        db.commit()

        print("Seed data created successfully.")
        print("Admin: admin@test.com / admin123")
        print("Driver: driver@test.com / driver123")
        print("Customer: customer@test.com / customer123")
        print(f"Truck IDs: {truck1.id}, {truck2.id}")
        print(f"Driver ID: {driver.id}")
        print(f"Customer ID: {customer.id}")
        print(f"Order ID: {order.id}")
        print(f"Parcel ID: {parcel.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
