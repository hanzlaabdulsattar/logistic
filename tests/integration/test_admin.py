import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure .env is loaded from project root
os.chdir(Path(__file__).resolve().parents[2])

from app.core.database import Base, get_db
from app.main import app
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
        db.add(
            User(
                email="admin@test.com",
                password_hash=hash_password("admin123"),
                full_name="Admin User",
                role=UserRole.ADMIN,
            )
        )
        db.add(
            User(
                email="customer@test.com",
                password_hash=hash_password("customer123"),
                full_name="Customer One",
                role=UserRole.CUSTOMER,
            )
        )
        db.add(
            User(
                email="driver@test.com",
                password_hash=hash_password("driver123"),
                full_name="Driver One",
                role=UserRole.DRIVER,
            )
        )
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
def admin_token() -> str:
    return login("admin@test.com", "admin123")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_and_login():
    response = client.post(
        "/auth/register",
        json={
            "email": "new@test.com",
            "password": "pass123",
            "full_name": "New User",
            "role": "customer",
        },
    )
    assert response.status_code == 200
    token = login("new@test.com", "pass123")
    assert token


def test_admin_requires_auth():
    assert client.get("/admin/trucks/").status_code == 401


def test_admin_forbids_customer():
    token = login("customer@test.com", "customer123")
    response = client.get("/admin/trucks/", headers=auth(token))
    assert response.status_code == 403


def test_truck_crud(admin_token):
    headers = auth(admin_token)
    create = client.post(
        "/admin/trucks/",
        headers=headers,
        json={
            "plate_number": "LHR-TEST-1",
            "model": "Hino 300",
            "capacity_kg": 12000,
        },
    )
    assert create.status_code == 200
    truck_id = create.json()["id"]

    listed = client.get("/admin/trucks/", headers=headers)
    assert listed.status_code == 200
    assert any(t["id"] == truck_id for t in listed.json())

    updated = client.put(
        f"/admin/trucks/{truck_id}",
        headers=headers,
        json={"status": "available", "capacity_kg": 15000},
    )
    assert updated.status_code == 200
    assert updated.json()["capacity_kg"] == 15000

    deleted = client.delete(f"/admin/trucks/{truck_id}", headers=headers)
    assert deleted.status_code == 200


def test_driver_crud(admin_token):
    headers = auth(admin_token)
    create = client.post(
        "/admin/drivers/",
        headers=headers,
        json={"user_id": 3, "license_number": "LIC-TEST-1"},
    )
    assert create.status_code == 200
    driver_id = create.json()["id"]

    listed = client.get("/admin/drivers/", headers=headers)
    assert listed.status_code == 200

    updated = client.put(
        f"/admin/drivers/{driver_id}",
        headers=headers,
        json={"status": "on_leave"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "on_leave"

    deleted = client.delete(f"/admin/drivers/{driver_id}", headers=headers)
    assert deleted.status_code == 200


def test_order_requires_customer(admin_token):
    headers = auth(admin_token)
    response = client.post(
        "/admin/orders/",
        headers=headers,
        json={
            "customer_id": 999,
            "pickup_lat": 31.5,
            "pickup_lng": 74.3,
            "delivery_lat": 33.6,
            "delivery_lng": 73.0,
        },
    )
    assert response.status_code == 404


def test_customer_order_parcel_flow(admin_token):
    headers = auth(admin_token)

    truck = client.post(
        "/admin/trucks/",
        headers=headers,
        json={"plate_number": "FLOW-1", "model": "Isuzu", "capacity_kg": 5000},
    ).json()

    driver_user = client.post(
        "/auth/register",
        json={
            "email": "flowdriver@test.com",
            "password": "pass123",
            "full_name": "Flow Driver",
            "role": "driver",
        },
    )
    assert driver_user.status_code == 200
    driver_user_id = driver_user.json()["id"]

    driver = client.post(
        "/admin/drivers/",
        headers=headers,
        json={
            "user_id": driver_user_id,
            "license_number": "LIC-FLOW-1",
            "truck_id": truck["id"],
        },
    ).json()

    customer = client.post(
        "/admin/customers/",
        headers=headers,
        json={"user_id": 2, "address": "Karachi"},
    )
    assert customer.status_code == 200
    customer_id = customer.json()["id"]

    order = client.post(
        "/admin/orders/",
        headers=headers,
        json={
            "customer_id": customer_id,
            "driver_id": driver["id"],
            "pickup_lat": 24.86,
            "pickup_lng": 67.0,
            "delivery_lat": 31.52,
            "delivery_lng": 74.35,
            "pickup_address": "Karachi Port",
            "delivery_address": "Lahore Hub",
        },
    )
    assert order.status_code == 200
    order_id = order.json()["id"]

    parcel = client.post(
        "/admin/parcels/",
        headers=headers,
        json={
            "order_id": order_id,
            "truck_id": truck["id"],
            "weight_kg": 100,
            "description": "Test parcel",
        },
    )
    assert parcel.status_code == 200
    assert parcel.json()["order_id"] == order_id

    stats = client.get("/admin/dashboard/stats", headers=headers).json()
    assert stats["total_trucks"] >= 1
    assert stats["total_orders"] >= 1
    assert stats["total_parcels"] >= 1


def test_incident_create_and_resolve(admin_token):
    headers = auth(admin_token)

    truck = client.post(
        "/admin/trucks/",
        headers=headers,
        json={"plate_number": "INC-1", "model": "Hino", "capacity_kg": 9000},
    ).json()

    driver_user = client.post(
        "/auth/register",
        json={
            "email": "incdriver@test.com",
            "password": "pass123",
            "full_name": "Inc Driver",
            "role": "driver",
        },
    ).json()
    driver = client.post(
        "/admin/drivers/",
        headers=headers,
        json={"user_id": driver_user["id"], "license_number": "LIC-INC-1"},
    ).json()

    incident = client.post(
        "/admin/incidents/",
        headers=headers,
        json={
            "truck_id": truck["id"],
            "driver_id": driver["id"],
            "type": "breakdown",
            "description": "Engine failure on highway",
            "lat": 31.5,
            "lng": 74.3,
        },
    )
    assert incident.status_code == 200
    incident_id = incident.json()["id"]
    assert incident.json()["status"] == "reported"

    truck_after = client.get(f"/admin/trucks/{truck['id']}", headers=headers).json()
    assert truck_after["status"] == "breakdown"

    resolved = client.post(
        f"/admin/incidents/{incident_id}/resolve",
        headers=headers,
        json={"status": "resolved"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"


def test_dashboard_overview(admin_token):
    headers = auth(admin_token)
    response = client.get("/admin/dashboard/overview", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "stats" in data
    assert "live_map" in data
    assert "recent_incidents" in data


def test_users_list_and_update(admin_token):
    headers = auth(admin_token)
    users = client.get("/admin/users/", headers=headers)
    assert users.status_code == 200
    assert len(users.json()) >= 3

    updated = client.put(
        "/admin/users/2",
        headers=headers,
        json={"is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False
