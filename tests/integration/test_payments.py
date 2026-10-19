import hashlib
import hmac
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.chdir(Path(__file__).resolve().parents[2])

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models.customer import Customer
from app.models.order import Order, OrderStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole
from app.modules.auth.dependencies import hash_password
from app.modules.payments import safepay, service

engine = create_engine(
    "sqlite://",
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


client = TestClient(app)
ORDER_AMOUNT = 146.0


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        users = [
            User(email="admin@test.com", password_hash=hash_password("admin123"),
                 full_name="Admin", role=UserRole.ADMIN),
            User(email="customer@test.com", password_hash=hash_password("customer123"),
                 full_name="Customer", role=UserRole.CUSTOMER),
            User(email="other@test.com", password_hash=hash_password("other123"),
                 full_name="Other", role=UserRole.CUSTOMER),
        ]
        db.add_all(users)
        db.flush()
        customer = Customer(user_id=users[1].id)
        db.add_all([customer, Customer(user_id=users[2].id)])
        db.flush()
        db.add(
            Order(
                customer_id=customer.id,
                status=OrderStatus.PENDING,
                pickup_lat=31.5204,
                pickup_lng=74.3587,
                delivery_lat=31.5704,
                delivery_lng=74.4087,
                weight_kg=5,
                distance_km=7.3,
                rate_per_km=20,
                amount=ORDER_AMOUNT,
                currency="PKR",
            )
        )
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def live_safepay(monkeypatch):
    monkeypatch.setattr(settings, "safepay_public_key", "sec_test_public")
    monkeypatch.setattr(settings, "safepay_secret_key", "test_secret")
    monkeypatch.setattr(settings, "safepay_webhook_secret", "webhook_secret")
    monkeypatch.setattr(safepay, "create_tracker", lambda amount, currency: "track_abc123")


def auth(email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def customer() -> dict:
    return auth("customer@test.com", "customer123")


def order_id() -> int:
    db = TestingSessionLocal()
    try:
        return db.query(Order).first().id
    finally:
        db.close()


def test_demo_checkout_uses_server_amount_and_completes():
    headers = customer()
    res = client.post(
        "/payments/safe-pay", headers=headers, json={"order_id": order_id(), "amount": 1}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["demo_mode"] is True
    assert body["amount"] == ORDER_AMOUNT  # client amount ignored
    assert "/customer/payments/checkout?payment_id=" in body["checkout_url"]

    paid = client.post(
        f"/payments/{body['payment_id']}/mark-paid", headers=headers, json={"status": "paid"}
    )
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"

    summary = client.get(f"/orders/{order_id()}/payment", headers=headers).json()
    assert summary["can_pay"] is False
    again = client.post("/payments/safe-pay", headers=headers, json={"order_id": order_id()})
    assert again.status_code == 409
    cod = client.post("/payments/cod", headers=headers, json={"order_id": order_id()})
    assert cod.status_code == 409


def test_other_customer_cannot_touch_payment():
    created = client.post(
        "/payments/safe-pay", headers=customer(), json={"order_id": order_id()}
    ).json()
    other = auth("other@test.com", "other123")
    assert client.post(
        "/payments/safe-pay", headers=other, json={"order_id": order_id()}
    ).status_code == 404
    assert client.get(f"/payments/{created['payment_id']}", headers=other).status_code == 404
    assert client.post(
        f"/payments/{created['payment_id']}/mark-paid", headers=other, json={"status": "paid"}
    ).status_code == 404
    assert client.get(f"/orders/{order_id()}/payment", headers=other).status_code == 404
    assert client.get(f"/payments/{created['payment_id']}").status_code == 401


def test_live_checkout_redirect_signature(live_safepay):
    headers = customer()
    body = client.post(
        "/payments/safe-pay",
        headers=headers,
        json={"order_id": order_id(), "return_url": "http://localhost:5173/customer/payments/result"},
    ).json()
    assert body["demo_mode"] is False
    url = urlparse(body["checkout_url"])
    query = parse_qs(url.query)
    assert url.netloc == "sandbox.api.getsafepay.com"
    assert query["beacon"] == ["track_abc123"]
    assert query["redirect_url"][0].startswith("http://127.0.0.1:8000/payments/safepay/return")

    # Client can no longer self-confirm in live mode
    assert client.post(
        f"/payments/{body['payment_id']}/mark-paid", headers=headers, json={"status": "paid"}
    ).status_code == 403

    redirect = query["redirect_url"][0]
    forged = client.post(
        redirect, data={"tracker": "track_abc123", "sig": "forged"}, follow_redirects=False
    )
    assert forged.status_code == 303
    assert client.get(f"/payments/{body['payment_id']}", headers=headers).json()["status"] == "failed"

    # Retry gets a fresh payment; genuine signature marks it paid
    body = client.post(
        "/payments/safe-pay",
        headers=headers,
        json={"order_id": order_id(), "return_url": "http://localhost:5173/customer/payments/result"},
    ).json()
    redirect = parse_qs(urlparse(body["checkout_url"]).query)["redirect_url"][0]
    sig = hmac.new(b"test_secret", b"track_abc123", hashlib.sha256).hexdigest()
    res = client.post(
        redirect,
        data={"tracker": "track_abc123", "sig": sig, "reference": "REF1"},
        follow_redirects=False,
    )
    assert res.status_code == 303
    assert res.headers["location"].startswith("http://localhost:5173/customer/payments/result?")
    assert "status=paid" in res.headers["location"]


def test_return_never_redirects_to_untrusted_origin(live_safepay):
    body = client.post("/payments/safe-pay", headers=customer(), json={"order_id": order_id()}).json()
    res = client.get(
        f"/payments/safepay/return?payment_id={body['payment_id']}&frontend=https://evil.example",
        follow_redirects=False,
    )
    assert res.headers["location"].startswith(settings.frontend_base_url)


def test_webhook_marks_paid(live_safepay):
    body = client.post("/payments/safe-pay", headers=customer(), json={"order_id": order_id()}).json()
    data = {
        "type": "payment:created",
        "notification": {"tracker": "track_abc123", "reference": "R9", "state": "PAID"},
    }
    raw = json.dumps(data, separators=(",", ":")).encode()
    sig = hmac.new(b"webhook_secret", raw, hashlib.sha512).hexdigest()

    bad = client.post("/payments/safepay/webhook", json={"data": data},
                      headers={"X-SFPY-SIGNATURE": "nope"})
    assert bad.status_code == 401
    ok = client.post("/payments/safepay/webhook", json={"data": data},
                     headers={"X-SFPY-SIGNATURE": sig})
    assert ok.status_code == 200
    payment = client.get(f"/payments/{body['payment_id']}", headers=customer()).json()
    assert payment["status"] == "paid"


def test_cod_settles_on_delivery():
    headers = customer()
    online = client.post("/payments/safe-pay", headers=headers, json={"order_id": order_id()}).json()
    cod = client.post("/payments/cod", headers=headers, json={"order_id": order_id(), "amount": 1})
    assert cod.status_code == 200
    assert cod.json()["amount"] == ORDER_AMOUNT
    assert client.get(f"/payments/{online['payment_id']}", headers=headers).json()["status"] == "cancelled"

    db = TestingSessionLocal()
    try:
        order = db.query(Order).first()
        service.settle_cod_on_delivery(db, order)
        db.commit()
        status = db.query(Payment).filter(Payment.id == cod.json()["payment_id"]).one().status
        assert status == PaymentStatus.PAID
    finally:
        db.close()
