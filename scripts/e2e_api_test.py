"""Full E2E API test for logistics platform (live server :8000)."""

from __future__ import annotations

import sys
import time
import uuid

import httpx

BASE = "http://127.0.0.1:8000"
results: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> bool:
    results.append((name, bool(cond), detail))
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f" | {detail}" if detail else ""))
    return cond


def login(email: str, password: str) -> str:
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def j(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main() -> int:
    ts = str(int(time.time()))[-6:]
    email = f"e2e_admin_{ts}@test.com"
    email_cust = f"e2e_cust_{ts}@test.com"
    email_drv = f"e2e_drv_{ts}@test.com"
    pw = "secret123"

    client = httpx.Client(timeout=30)

    # ---------- AUTH ----------
    print("\n=== AUTH ===")
    r = client.get(f"{BASE}/health")
    check("health", r.status_code == 200 and r.json().get("status") == "ok", str(r.json()))

    r = client.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": pw, "full_name": "E2E Admin", "role": "admin"},
    )
    check("register admin", r.status_code == 200, str(r.json())[:120])

    r = client.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
    check("login admin json", r.status_code == 200 and "access_token" in r.json())
    admin_token = r.json()["access_token"] if r.status_code == 200 else ""

    # Swagger OAuth2 form login
    r = client.post(
        f"{BASE}/auth/login",
        data={"username": email, "password": pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    check("login admin oauth2 form", r.status_code == 200 and "access_token" in r.json())

    r = client.post(f"{BASE}/auth/login", json={"email": email, "password": "wrong"})
    check("login wrong password 401", r.status_code == 401)

    r = client.get(f"{BASE}/auth/me", headers=auth(admin_token))
    check("auth/me", r.status_code == 200 and r.json()["role"] == "admin")

    # register customer + driver users
    r = client.post(
        f"{BASE}/auth/register",
        json={"email": email_cust, "password": pw, "full_name": "E2E Cust", "role": "customer"},
    )
    check("register customer", r.status_code == 200)
    r = client.post(f"{BASE}/auth/login", json={"email": email_cust, "password": pw})
    cust_token = r.json()["access_token"] if r.status_code == 200 else ""
    cust_user_id = r.json()["user"]["id"] if r.status_code == 200 else None

    r = client.post(
        f"{BASE}/auth/register",
        json={"email": email_drv, "password": pw, "full_name": "E2E Drv", "role": "driver"},
    )
    check("register driver user", r.status_code == 200)
    r = client.post(f"{BASE}/auth/login", json={"email": email_drv, "password": pw})
    drv_token_user = r.json()["access_token"] if r.status_code == 200 else ""
    drv_user_id = r.json()["user"]["id"] if r.status_code == 200 else None

    # authz
    r = client.get(f"{BASE}/admin/trucks/", headers=auth(cust_token))
    check("customer blocked from admin", r.status_code == 403)
    r = client.get(f"{BASE}/driver/profile/me", headers=auth(admin_token))
    check("admin blocked from driver", r.status_code == 403)
    r = client.get(f"{BASE}/user/profile/me", headers=auth(admin_token))
    check("admin blocked from user", r.status_code == 403)
    r = client.get(f"{BASE}/admin/trucks/")
    check("no token 401", r.status_code == 401)

    # ---------- ADMIN SETUP ----------
    print("\n=== ADMIN SETUP ===")
    plate = f"E2E-{uuid.uuid4().hex[:6].upper()}"
    r = client.post(
        f"{BASE}/admin/trucks/",
        headers=j(admin_token),
        json={"plate_number": plate, "model": "Hino E2E", "capacity_kg": 10000},
    )
    check("admin create truck", r.status_code == 200, str(r.json())[:100])
    truck_id = r.json()["id"] if r.status_code == 200 else None

    r = client.post(
        f"{BASE}/admin/drivers/",
        headers=j(admin_token),
        json={"user_id": drv_user_id, "license_number": f"LIC-{uuid.uuid4().hex[:8]}", "truck_id": truck_id},
    )
    check("admin create driver profile", r.status_code == 200, str(r.json())[:100])
    driver_id = r.json()["id"] if r.status_code == 200 else None

    r = client.post(
        f"{BASE}/admin/customers/",
        headers=j(admin_token),
        json={"user_id": cust_user_id, "address": "E2E City"},
    )
    # may 400 if auto-created by user module; then list and use existing
    if r.status_code == 200:
        customer_id = r.json()["id"]
        check("admin create customer", True)
    else:
        r2 = client.get(f"{BASE}/admin/customers/", headers=auth(admin_token))
        customer_id = None
        if r2.status_code == 200:
            for c in r2.json():
                if c.get("user_id") == cust_user_id:
                    customer_id = c["id"]
                    break
        check("admin customer exists (auto or created)", customer_id is not None, str(r.json())[:80])

    r = client.get(f"{BASE}/admin/dashboard/stats", headers=auth(admin_token))
    check("admin dashboard stats", r.status_code == 200 and "total_trucks" in r.json())

    r = client.get(f"{BASE}/admin/dashboard/live-map", headers=auth(admin_token))
    check("admin live-map", r.status_code == 200 and isinstance(r.json(), list))

    r = client.get(f"{BASE}/admin/dashboard/overview", headers=auth(admin_token))
    check("admin dashboard overview", r.status_code == 200 and "stats" in r.json())

    r = client.get(f"{BASE}/admin/trucks/", headers=auth(admin_token), params={"status": "available"})
    check("admin trucks filter available", r.status_code == 200)

    r = client.get(f"{BASE}/admin/users/", headers=auth(admin_token), params={"role": "customer"})
    check("admin users filter role", r.status_code == 200)

    r = client.get(f"{BASE}/admin/trucks/{truck_id}", headers=auth(admin_token))
    check("admin get truck", r.status_code == 200)

    r = client.put(
        f"{BASE}/admin/trucks/{truck_id}",
        headers=j(admin_token),
        json={"capacity_kg": 11000},
    )
    check("admin update truck", r.status_code == 200 and r.json()["capacity_kg"] == 11000)

    # ---------- DRIVER FLOW ----------
    print("\n=== DRIVER FLOW ===")
    # driver user needs profile from admin — already created
    # login driver with user credentials (profile exists)
    r = client.post(f"{BASE}/auth/login", json={"email": email_drv, "password": pw})
    drv_token = r.json()["access_token"]
    check("driver login", r.status_code == 200)

    r = client.get(f"{BASE}/driver/profile/me", headers=auth(drv_token))
    check("driver profile/me", r.status_code == 200 and r.json()["user"]["email"] == email_drv)
    check("driver has truck", r.json().get("truck") is not None)

    r = client.get(f"{BASE}/driver/trucks/my", headers=auth(drv_token))
    check("driver trucks/my", r.status_code == 200 and r.json()["id"] == truck_id)

    r = client.patch(
        f"{BASE}/driver/trucks/{truck_id}/status",
        headers=j(drv_token),
        json={"status": "in_transit"},
    )
    check("driver truck status in_transit", r.status_code == 200 and r.json()["status"] == "in_transit")

    r = client.patch(
        f"{BASE}/driver/trucks/{truck_id}/status",
        headers=j(drv_token),
        json={"status": "maintenance"},
    )
    check("driver cannot set maintenance", r.status_code == 400)

    r = client.patch(
        f"{BASE}/driver/profile/status",
        headers=j(drv_token),
        json={"status": "on_delivery"},
    )
    check("driver profile status update", r.status_code == 200 and r.json()["status"] == "on_delivery")

    # customer creates order
    r = client.post(
        f"{BASE}/user/orders/",
        headers=j(cust_token),
        json={
            "pickup_lat": 31.5,
            "pickup_lng": 74.3,
            "delivery_lat": 33.6,
            "delivery_lng": 73.0,
            "pickup_address": "Pickup",
            "delivery_address": "Drop",
        },
    )
    check("customer create order", r.status_code == 200 and r.json()["status"] == "pending")
    order_id = r.json()["id"]

    # admin assigns order to driver
    r = client.put(
        f"{BASE}/admin/orders/{order_id}",
        headers=j(admin_token),
        json={"driver_id": driver_id, "status": "assigned"},
    )
    check("admin assign order to driver", r.status_code == 200 and r.json()["status"] == "assigned")

    # driver deliveries
    r = client.get(f"{BASE}/driver/deliveries/", headers=auth(drv_token))
    check("driver deliveries list", r.status_code == 200 and any(d["id"] == order_id for d in r.json()))

    r = client.get(f"{BASE}/driver/deliveries/{order_id}", headers=auth(drv_token))
    check("driver delivery detail", r.status_code == 200)

    r = client.patch(
        f"{BASE}/driver/deliveries/{order_id}/status",
        headers=j(drv_token),
        json={"status": "in_transit"},
    )
    check("driver delivery in_transit", r.status_code == 200 and r.json()["status"] == "in_transit")

    r = client.patch(
        f"{BASE}/driver/deliveries/{order_id}/status",
        headers=j(drv_token),
        json={"status": "delivered"},
    )
    check("driver delivery delivered", r.status_code == 200 and r.json()["status"] == "delivered")

    # admin parcel on order
    r = client.post(
        f"{BASE}/admin/parcels/",
        headers=j(admin_token),
        json={"order_id": order_id, "truck_id": truck_id, "weight_kg": 25, "description": "E2E parcel"},
    )
    check("admin create parcel", r.status_code == 200)
    parcel_id = r.json()["id"] if r.status_code == 200 else None

    r = client.get(f"{BASE}/user/parcels/", headers=auth(cust_token), params={"order_id": order_id})
    check("customer sees parcels on order", r.status_code == 200 and len(r.json()) >= 1)

    r = client.get(f"{BASE}/user/orders/{order_id}", headers=auth(cust_token))
    check("customer tracks order delivered", r.status_code == 200 and r.json()["status"] == "delivered")

    # incident + recovery
    print("\n=== INCIDENT + RECOVERY ===")
    r = client.post(
        f"{BASE}/driver/incidents/",
        headers=j(drv_token),
        json={"type": "breakdown", "description": "E2E breakdown", "lat": 31.5, "lng": 74.3},
    )
    check("driver report incident", r.status_code == 200 and r.json()["status"] == "reported")
    incident_id = r.json()["id"]

    r = client.get(f"{BASE}/driver/trucks/my", headers=auth(drv_token))
    check("truck breakdown after incident", r.json()["status"] == "breakdown")

    r = client.get(f"{BASE}/admin/incidents/", headers=auth(admin_token), params={"status": "reported"})
    check("admin sees reported incident", r.status_code == 200 and any(i["id"] == incident_id for i in r.json()))

    # admin creates recovery request for another driver
    plate2 = f"E2E2-{uuid.uuid4().hex[:6].upper()}"
    r = client.post(
        f"{BASE}/admin/trucks/",
        headers=j(admin_token),
        json={"plate_number": plate2, "model": "Isuzu E2E", "capacity_kg": 8000},
    )
    truck2_id = r.json()["id"]
    email_drv2 = f"e2e_drv2_{ts}@test.com"
    client.post(
        f"{BASE}/auth/register",
        json={"email": email_drv2, "password": pw, "full_name": "E2E Drv2", "role": "driver"},
    )
    r = client.post(f"{BASE}/auth/login", json={"email": email_drv2, "password": pw})
    drv2_user_id = r.json()["user"]["id"]
    r = client.post(
        f"{BASE}/admin/drivers/",
        headers=j(admin_token),
        json={"user_id": drv2_user_id, "license_number": f"LIC2-{uuid.uuid4().hex[:8]}", "truck_id": truck2_id},
    )
    driver2_id = r.json()["id"]
    drv2_token = r.json() and client.post(f"{BASE}/auth/login", json={"email": email_drv2, "password": pw}).json()["access_token"]

    # admin recovery monitoring endpoints
    r = client.get(f"{BASE}/admin/recovery/requests", headers=auth(admin_token))
    check("admin recovery requests list", r.status_code == 200)

    # insert recovery via direct DB for driver2 to accept
    from app.core.database import SessionLocal
    from app.models.recovery_request import RecoveryRequest, RecoveryRequestStatus

    db = SessionLocal()
    try:
        rec = RecoveryRequest(
            incident_id=incident_id,
            source_truck_id=truck_id,
            target_truck_id=truck2_id,
            target_driver_id=driver2_id,
            status=RecoveryRequestStatus.PENDING,
            distance_km=4.2,
            free_space_kg=6000,
            ai_reasoning="E2E nearest available",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        rec_id = rec.id
    finally:
        db.close()

    r = client.get(f"{BASE}/driver/recovery/requests", headers=auth(drv2_token))
    check("driver2 sees recovery request", r.status_code == 200 and any(x["id"] == rec_id for x in r.json()))

    r = client.post(f"{BASE}/driver/recovery/requests/{rec_id}/accept", headers=auth(drv2_token))
    check("driver2 accept recovery", r.status_code == 200 and r.json()["status"] == "accepted")

    r = client.post(f"{BASE}/driver/recovery/requests/{rec_id}/reject", headers=auth(drv2_token))
    check("driver2 reject already decided 400", r.status_code == 400)

    r = client.get(f"{BASE}/admin/recovery/requests", headers=auth(admin_token), params={"status": "accepted"})
    check("admin sees accepted recovery", r.status_code == 200 and any(x["id"] == rec_id for x in r.json()))

    r = client.post(
        f"{BASE}/admin/incidents/{incident_id}/resolve",
        headers=j(admin_token),
        json={"status": "resolved"},
    )
    check("admin resolve incident", r.status_code == 200 and r.json()["status"] == "resolved")

    # ---------- USER MODULE extras ----------
    print("\n=== USER MODULE ===")
    r = client.get(f"{BASE}/user/profile/me", headers=auth(cust_token))
    check("customer profile/me", r.status_code == 200)
    r = client.patch(
        f"{BASE}/user/profile/me",
        headers=j(cust_token),
        json={"address": "Updated Addr"},
    )
    check("customer update profile", r.status_code == 200 and r.json()["address"] == "Updated Addr")

    r = client.get(f"{BASE}/user/orders/", headers=auth(cust_token))
    check("customer orders list", r.status_code == 200 and len(r.json()) >= 1)

    # create + cancel another order
    r = client.post(
        f"{BASE}/user/orders/",
        headers=j(cust_token),
        json={"pickup_lat": 31.0, "pickup_lng": 74.0, "delivery_lat": 32.0, "delivery_lng": 73.0},
    )
    cancel_id = r.json()["id"]
    r = client.post(f"{BASE}/user/orders/{cancel_id}/cancel", headers=auth(cust_token))
    check("customer cancel order", r.status_code == 200 and r.json()["status"] == "cancelled")

    # cannot cancel delivered
    r = client.post(f"{BASE}/user/orders/{order_id}/cancel", headers=auth(cust_token))
    check("customer cannot cancel delivered 400", r.status_code == 400)

    r = client.get(f"{BASE}/user/notifications/", headers=auth(cust_token))
    check("customer notifications list", r.status_code == 200)
    if r.json():
        nid = r.json()[0]["id"]
        r2 = client.post(f"{BASE}/user/notifications/{nid}/read", headers=auth(cust_token))
        check("customer mark notification read", r2.status_code == 200)

    # admin maintenance
    print("\n=== ADMIN MAINTENANCE + USERS ===")
    r = client.post(
        f"{BASE}/admin/maintenance/",
        headers=j(admin_token),
        json={"truck_id": truck_id, "type": "scheduled", "description": "Oil change"},
    )
    check("admin create maintenance", r.status_code == 200)
    r = client.get(f"{BASE}/admin/maintenance/", headers=auth(admin_token), params={"truck_id": truck_id})
    check("admin list maintenance", r.status_code == 200 and len(r.json()) >= 1)

    r = client.put(
        f"{BASE}/admin/users/{cust_user_id}",
        headers=j(admin_token),
        json={"phone": "+923001112233"},
    )
    check("admin update user phone", r.status_code == 200)

    r = client.get(f"{BASE}/admin/drivers/", headers=auth(admin_token), params={"status": "on_delivery"})
    check("admin drivers filter on_delivery", r.status_code == 200)

    # duplicate plate
    r = client.post(
        f"{BASE}/admin/trucks/",
        headers=j(admin_token),
        json={"plate_number": plate, "model": "Dup", "capacity_kg": 1},
    )
    check("duplicate plate 400", r.status_code == 400)

    # delete truck that has driver? skip if FK; delete maintenance record instead
    r = client.get(f"{BASE}/admin/maintenance/", headers=auth(admin_token), params={"truck_id": truck_id})
    if r.json():
        mid = r.json()[0]["id"]
        r2 = client.delete(f"{BASE}/admin/maintenance/{mid}", headers=auth(admin_token))
        check("admin delete maintenance", r2.status_code == 200)

    # ---------- SUMMARY ----------
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print("\n========== SUMMARY ==========")
    print(f"TOTAL: {len(results)}  PASS: {passed}  FAIL: {failed}")
    if failed:
        print("\nFailed checks:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
