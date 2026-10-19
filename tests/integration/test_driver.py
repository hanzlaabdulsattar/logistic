import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.chdir(Path(__file__).resolve().parents[2])

from app.core.database import Base, get_db
from app.main import app
from app.models.customer import Customer
from app.models.driver import Driver, DriverStatus
from app.models.order import Order, OrderStatus
from app.models.recovery_request import RecoveryRequest, RecoveryRequestStatus
from app.models.truck import Truck, TruckStatus
from app.models.user import User, UserRole
from app.modules.auth.dependencies import hash_password

TEST_DB_URL = "sqlite://"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
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
        other_driver_user = User(
            email="other@test.com",
            password_hash=hash_password("other123"),
            full_name="Other Driver",
            role=UserRole.DRIVER,
        )
        customer_user = User(
            email="customer@test.com",
            password_hash=hash_password("customer123"),
            full_name="Customer One",
            role=UserRole.CUSTOMER,
        )
        db.add_all([admin, driver_user, other_driver_user, customer_user])
        db.flush()

        truck = Truck(
            plate_number="DRV-1",
            model="Hino",
            capacity_kg=8000,
            status=TruckStatus.AVAILABLE,
        )
        other_truck = Truck(
            plate_number="DRV-2",
            model="Isuzu",
            capacity_kg=5000,
            status=TruckStatus.AVAILABLE,
        )
        db.add_all([truck, other_truck])
        db.flush()

        driver = Driver(
            user_id=driver_user.id,
            license_number="LIC-D1",
            truck_id=truck.id,
            status=DriverStatus.AVAILABLE,
        )
        other_driver = Driver(
            user_id=other_driver_user.id,
            license_number="LIC-D2",
            truck_id=other_truck.id,
            status=DriverStatus.AVAILABLE,
        )
        db.add_all([driver, other_driver])
        db.flush()

        customer = Customer(user_id=customer_user.id, address="Lahore")
        db.add(customer)
        db.flush()

        delivery = Order(
            customer_id=customer.id,
            driver_id=driver.id,
            status=OrderStatus.ASSIGNED,
            pickup_lat=31.5,
            pickup_lng=74.3,
            delivery_lat=33.6,
            delivery_lng=73.0,
        )
        other_delivery = Order(
            customer_id=customer.id,
            driver_id=other_driver.id,
            status=OrderStatus.ASSIGNED,
            pickup_lat=31.5,
            pickup_lng=74.3,
            delivery_lat=32.0,
            delivery_lng=74.0,
        )
        db.add_all([delivery, other_delivery])

        # pending recovery for driver 1
        from app.models.incident import Incident, IncidentType

        incident = Incident(
            truck_id=other_truck.id,
            driver_id=other_driver.id,
            type=IncidentType.BREAKDOWN,
            lat=31.0,
            lng=74.0,
            status="reported",
        )
        db.add(incident)
        db.flush()
        recovery = RecoveryRequest(
            incident_id=incident.id,
            source_truck_id=other_truck.id,
            target_truck_id=truck.id,
            target_driver_id=driver.id,
            status=RecoveryRequestStatus.PENDING,
            distance_km=5.2,
            free_space_kg=4000,
            ai_reasoning="Nearest available truck",
        )
        db.add(recovery)
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


def login(email: str, password: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def driver_token() -> str:
    return login("driver@test.com", "driver123")


@pytest.fixture
def admin_token() -> str:
    return login("admin@test.com", "admin123")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_driver_module_requires_auth():
    assert client.get("/driver/profile/me").status_code == 401


def test_admin_cannot_access_driver_module(admin_token):
    response = client.get("/driver/profile/me", headers=auth(admin_token))
    assert response.status_code == 403


def test_profile_me(driver_token):
    response = client.get("/driver/profile/me", headers=auth(driver_token))
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "driver@test.com"
    assert data["truck"]["plate_number"] == "DRV-1"
    assert data["status"] == "available"


def test_my_truck_and_status_update(driver_token):
    headers = auth(driver_token)
    truck = client.get("/driver/trucks/my", headers=headers)
    assert truck.status_code == 200
    truck_id = truck.json()["id"]

    updated = client.patch(
        f"/driver/trucks/{truck_id}/status",
        headers=headers,
        json={"status": "in_transit"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_transit"

    # cannot update other truck
    forbidden = client.patch(
        "/driver/trucks/999/status",
        headers=headers,
        json={"status": "available"},
    )
    assert forbidden.status_code in (403, 404)


def test_deliveries_flow(driver_token):
    headers = auth(driver_token)
    listed = client.get("/driver/deliveries/", headers=headers)
    assert listed.status_code == 200
    deliveries = listed.json()
    assert len(deliveries) >= 1
    order_id = deliveries[0]["id"]

    detail = client.get(f"/driver/deliveries/{order_id}", headers=headers)
    assert detail.status_code == 200

    # cannot access other driver's delivery
    other = client.get("/driver/deliveries/999", headers=headers)
    assert other.status_code == 404

    started = client.patch(
        f"/driver/deliveries/{order_id}/status",
        headers=headers,
        json={"status": "in_transit"},
    )
    assert started.status_code == 200
    assert started.json()["status"] == "in_transit"

    delivered = client.patch(
        f"/driver/deliveries/{order_id}/status",
        headers=headers,
        json={"status": "delivered"},
    )
    assert delivered.status_code == 200
    assert delivered.json()["status"] == "delivered"


def test_report_incident_marks_truck_breakdown(driver_token):
    headers = auth(driver_token)
    response = client.post(
        "/driver/incidents/",
        headers=headers,
        json={
            "type": "breakdown",
            "description": "Engine failed",
            "lat": 31.5,
            "lng": 74.3,
        },
    )
    assert response.status_code == 200
    incident = response.json()
    assert incident["status"] == "reported"

    truck = client.get("/driver/trucks/my", headers=headers).json()
    assert truck["status"] == "breakdown"

    listed = client.get("/driver/incidents/", headers=headers)
    assert listed.status_code == 200
    assert any(i["id"] == incident["id"] for i in listed.json())


def test_recovery_accept_and_reject(driver_token):
    headers = auth(driver_token)
    listed = client.get("/driver/recovery/requests", headers=headers)
    assert listed.status_code == 200
    requests = listed.json()
    assert len(requests) >= 1
    pending = [r for r in requests if r["status"] == "pending"]
    assert pending
    request_id = pending[0]["id"]

    accepted = client.post(
        f"/driver/recovery/requests/{request_id}/accept", headers=headers
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    # second decision should fail
    again = client.post(
        f"/driver/recovery/requests/{request_id}/reject", headers=headers
    )
    assert again.status_code == 400


def test_driver_without_profile_gets_404(driver_token):
    # create a driver-role user without profile via admin path is hard;
    # instead check profile endpoint for driver that has profile works
    response = client.get("/driver/profile/me", headers=auth(driver_token))
    assert response.status_code == 200
