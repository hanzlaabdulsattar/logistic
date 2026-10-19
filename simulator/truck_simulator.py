from __future__ import annotations

import asyncio
import math
import random
import time

import httpx

API = "http://127.0.0.1:8000"
EMAIL = "driver@test.com"
PASSWORD = "driver123"
INTERVAL_SEC = float(__import__("os").environ.get("SIM_INTERVAL", "3"))

# Lahore → Islamabad rough path (Pakistan)
ROUTE = [
    (31.5204, 74.3587),
    (31.5500, 74.3800),
    (31.6000, 74.4000),
    (32.0000, 74.2000),
    (33.0000, 73.5000),
    (33.6844, 73.0479),
]


def interpolate(a: tuple[float, float], b: tuple[float, float], t: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def main() -> None:
    print(f"Truck simulator → {API} every {INTERVAL_SEC}s")
    print(f"Login as {EMAIL}")
    with httpx.Client(timeout=20) as client:
        login = client.post(
            f"{API}/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        if login.status_code != 200:
            print("Login failed:", login.status_code, login.text)
            return
        token = login.json()["access_token"]
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        truck = client.get(f"{API}/driver/trucks/my", headers=headers)
        if truck.status_code != 200:
            print("No assigned truck for driver:", truck.status_code, truck.text)
            return
        truck_id = truck.json()["id"]
        print(f"Simulating truck id={truck_id} plate={truck.json().get('plate_number')}")

        step = 0
        while True:
            # walk along route then loop
            seg = step % (len(ROUTE) - 1)
            t = (step % 10) / 10.0
            lat, lng = interpolate(ROUTE[seg], ROUTE[seg + 1], t)
            lat += random.uniform(-0.0005, 0.0005)
            lng += random.uniform(-0.0005, 0.0005)
            status = "in_transit"
            try:
                r = client.post(
                    f"{API}/driver/trucks/{truck_id}/location",
                    headers=headers,
                    json={"lat": lat, "lng": lng, "status": status},
                )
                print(
                    time.strftime("%H:%M:%S"),
                    f"POST location -> {r.status_code}",
                    f"({lat:.5f},{lng:.5f})",
                )
            except Exception as exc:
                print("location post failed:", exc)
            step += 1
            time.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    main()
