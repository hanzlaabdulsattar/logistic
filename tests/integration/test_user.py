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
from app.models.notification import Notification, NotificationType
from app.models.order import Order, OrderStatus
from app.models.parcel import Parcel, ParcelStatus
from app.models.truck import Truck
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
        customer_user = User(
            email="customer@test.com",
            password_hash=hash_password("customer123"),
            full_name="Customer One",
            role=UserRole.CUSTOMER,
        )
        other_customer_user = User(
            email="other@test.com",
            password_hash=hash_password("other123"),
            full_name="Other Customer",
            role=UserRole.CUSTOMER,
        )
        db.add_all([admin, customer_user, other_customer_user])
        db.flush()

        truck = Truck(
            plate_number="USR-1",
            model="Hino",
            capacity_kg=8000,
        )
        db.add(truck)
        db.flush()

        order = Order(
            customer_id=1,  # will be set after customer created; use relationship carefully
            status=OrderStatus.PENDING,
            pickup_lat=31.5,
            pickup_lng=74.3,
            delivery_lat=33.6,
            delivery_lng=73.0,
            pickup_address="Lahore",
            delivery_address="Islamabad",
        )
        # customer rows created lazily via API; seed a known customer id path:
        # create customer profiles explicitly
        from app.models.customer import Customer

        cust1 = Customer(user_id=customer_user.id, address="Lahore")
        cust2 = Customer(user_id=other_customer_user.id, address="Karachi")
        db.add_all([cust1, cust2])
        db.flush()

        order.customer_id = cust1.id
        db.add(order)
        db.flush()

        parcel = Parcel(
            order_id=order.id,
            truck_id=truck.id,
            weight_kg=10,
            description="Seed parcel",
            status=ParcelStatus.PENDING,
        )
        db.add(parcel)

        notif = Notification(
            user_id=customer_user.id,
            type=NotificationType.ORDER_UPDATE,
            title="Order created",
            message="Your order is pending",
            is_read=False,
        )
        db.add(notif)
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
def customer_token() -> str:
    return login("customer@test.com", "customer123")


@pytest.fixture
def admin_token() -> str:
    return login("admin@test.com", "admin123")


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_user_module_requires_auth():
    assert client.get("/user/profile/me").status_code == 401


def test_admin_cannot_access_user_module(admin_token):
    response = client.get("/user/profile/me", headers=auth(admin_token))
    assert response.status_code == 403


def test_profile_get_and_update(customer_token):
    headers = auth(customer_token)
    profile = client.get("/user/profile/me", headers=headers)
    assert profile.status_code == 200
    data = profile.json()
    assert data["user"]["email"] == "customer@test.com"
    assert data["address"] == "Lahore"

    updated = client.patch(
        "/user/profile/me",
        headers=headers,
        json={"address": "Islamabad", "full_name": "Customer Updated"},
    )
    assert updated.status_code == 200
    assert updated.json()["address"] == "Islamabad"
    assert updated.json()["user"]["full_name"] == "Customer Updated"


def test_orders_list_and_detail(customer_token):
    headers = auth(customer_token)
    listed = client.get("/user/orders/", headers=headers)
    assert listed.status_code == 200
    orders = listed.json()
    assert len(orders) >= 1
    order_id = orders[0]["id"]

    detail = client.get(f"/user/orders/{order_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["id"] == order_id


def test_create_order(customer_token):
    headers = auth(customer_token)
    created = client.post(
        "/user/orders/",
        headers=headers,
        json={
            "pickup_lat": 31.5,
            "pickup_lng": 74.3,
            "delivery_lat": 24.86,
            "delivery_lng": 67.0,
            "pickup_address": "Lahore Warehouse",
            "delivery_address": "Karachi Port",
        },
    )
    assert created.status_code == 200
    assert created.json()["status"] == "pending"


def test_cancel_order(customer_token):
    headers = auth(customer_token)
    created = client.post(
        "/user/orders/",
        headers=headers,
        json={
            "pickup_lat": 31.5,
            "pickup_lng": 74.3,
            "delivery_lat": 33.6,
            "delivery_lng": 73.0,
        },
    ).json()
    cancelled = client.post(f"/user/orders/{created['id']}/cancel", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_parcels_visible_for_own_orders(customer_token):
    headers = auth(customer_token)
    listed = client.get("/user/parcels/", headers=headers)
    assert listed.status_code == 200
    parcels = listed.json()
    assert len(parcels) >= 1
    parcel_id = parcels[0]["id"]

    detail = client.get(f"/user/parcels/{parcel_id}", headers=headers)
    assert detail.status_code == 200


def test_notifications_list_and_read(customer_token):
    headers = auth(customer_token)
    listed = client.get("/user/notifications/", headers=headers)
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) >= 1
    notif_id = items[0]["id"]

    read = client.post(f"/user/notifications/{notif_id}/read", headers=headers)
    assert read.status_code == 200
    assert read.json()["is_read"] is True


def test_other_customer_cannot_see_my_order(customer_token):
    headers = auth(customer_token)
    my_order = client.get("/user/orders/", headers=headers).json()[0]

    other_token = login("other@test.com", "other123")
    other_headers = auth(other_token)
    # other customer auto-creates profile; should not see this order
    other_list = client.get("/user/orders/", headers=other_headers).json()
    assert all(o["id"] != my_order["id"] for o in other_list)

    forbidden = client.get(f"/user/orders/{my_order['id']}", headers=other_headers)
    assert forbidden.status_code == 403
