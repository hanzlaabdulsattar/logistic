from __future__ import annotations

import asyncio
import json
import math
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.core.redis_client import (
    LIVE_CHANNEL,
    get_live_location,
    get_live_locations,
    redis_available,
    store_live_location,
)
from app.models.driver import Driver
from app.models.truck import Truck, TruckStatus
from app.models.tracking_log import TrackingLog
from app.models.user import User

# Project spec: nearby rescue radius
NEARBY_RADIUS_KM = 10.0


class LocationHub:
    """WebSocket hub for live GPS + proximity stuck-truck alerts."""

    def __init__(self) -> None:
        # admin/map sockets
        self.connections: set[WebSocket] = set()
        # driver sockets keyed by driver_id (for targeted nearby alerts)
        self.driver_connections: dict[int, set[WebSocket]] = {}
        self._redis_task: asyncio.Task | None = None

    async def connect(self, websocket: WebSocket, driver_id: int | None = None) -> None:
        await websocket.accept()
        if driver_id is not None:
            self.driver_connections.setdefault(driver_id, set()).add(websocket)
        else:
            self.connections.add(websocket)
        await self.send_current_snapshot(websocket)

    def disconnect(self, websocket: WebSocket, driver_id: int | None = None) -> None:
        if driver_id is not None and driver_id in self.driver_connections:
            self.driver_connections[driver_id].discard(websocket)
            if not self.driver_connections[driver_id]:
                del self.driver_connections[driver_id]
        self.connections.discard(websocket)

    async def send_current_snapshot(self, websocket: WebSocket) -> None:
        payload = {
            "type": "snapshot",
            "trucks": get_live_locations(),
            "nearby_radius_km": NEARBY_RADIUS_KM,
        }
        try:
            await websocket.send_text(json.dumps(payload, default=str))
        except Exception:
            self.disconnect(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast to all map/admin sockets AND all driver sockets."""
        text = json.dumps(message, default=str)
        targets: list[tuple[WebSocket, int | None]] = [
            (ws, None) for ws in list(self.connections)
        ]
        for driver_id, sockets in list(self.driver_connections.items()):
            for ws in list(sockets):
                targets.append((ws, driver_id))

        dead: list[tuple[WebSocket, int | None]] = []
        for ws, driver_id in targets:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append((ws, driver_id))
        for ws, driver_id in dead:
            self.disconnect(ws, driver_id)

    async def broadcast_to_drivers(
        self, driver_ids: set[int], message: dict[str, Any]
    ) -> int:
        """Send message only to specific drivers (e.g. within 10km)."""
        text = json.dumps(message, default=str)
        sent = 0
        dead: list[tuple[int, WebSocket]] = []
        for driver_id in driver_ids:
            for ws in list(self.driver_connections.get(driver_id, set())):
                try:
                    await ws.send_text(text)
                    sent += 1
                except Exception:
                    dead.append((driver_id, ws))
        for driver_id, ws in dead:
            self.disconnect(ws, driver_id)
        # also fan-out to map sockets so admin dashboard can see it
        await self.broadcast({"type": "proximity_alert_fanout", **message})
        return sent

    async def ensure_redis_listener(self) -> None:
        if self._redis_task is not None and not self._redis_task.done():
            return
        if not redis_available():
            return
        self._redis_task = asyncio.create_task(self._listen_redis())

    async def _listen_redis(self) -> None:
        import redis.asyncio as aioredis

        from app.core.config import settings

        try:
            client = aioredis.from_url(settings.redis_url, decode_responses=True)
            pubsub = client.pubsub()
            await pubsub.subscribe(LIVE_CHANNEL)
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if not data:
                    continue
                try:
                    payload = json.loads(data)
                except json.JSONDecodeError:
                    continue
                await self.broadcast({"type": "location", "truck": payload})
        except Exception:
            pass


hub = LocationHub()


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two GPS points in kilometers."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def find_trucks_within_radius(
    db: Session,
    *,
    lat: float,
    lng: float,
    radius_km: float = NEARBY_RADIUS_KM,
    exclude_truck_id: int | None = None,
    only_operational: bool = True,
) -> list[dict[str, Any]]:
    """Return nearby trucks with distance_km (for rescue proximity alerts)."""
    trucks = db.query(Truck).all()
    results: list[dict[str, Any]] = []
    for t in trucks:
        if exclude_truck_id is not None and t.id == exclude_truck_id:
            continue
        if t.current_lat is None or t.current_lng is None:
            continue
        if only_operational and t.status in {
            TruckStatus.BREAKDOWN,
            TruckStatus.MAINTENANCE,
            TruckStatus.OFF_DUTY,
        }:
            continue
        dist = haversine_km(lat, lng, t.current_lat, t.current_lng)
        if dist <= radius_km:
            results.append(
                {
                    "truck_id": t.id,
                    "plate_number": t.plate_number,
                    "model": t.model,
                    "status": t.status.value,
                    "lat": t.current_lat,
                    "lng": t.current_lng,
                    "distance_km": round(dist, 3),
                }
            )
    results.sort(key=lambda x: x["distance_km"])
    return results


def drivers_for_trucks(db: Session, truck_ids: set[int]) -> dict[int, int]:
    """Map truck_id → driver_id for assigned drivers."""
    if not truck_ids:
        return {}
    rows = (
        db.query(Driver.id, Driver.truck_id)
        .filter(Driver.truck_id.in_(truck_ids))
        .all()
    )
    return {int(truck_id): int(driver_id) for driver_id, truck_id in rows if truck_id}


def notify_nearby_drivers(
    db: Session,
    *,
    incident_id: int,
    stuck_truck: Truck,
    lat: float,
    lng: float,
    incident_type: str,
    description: str | None,
    radius_km: float = NEARBY_RADIUS_KM,
) -> dict[str, Any]:
    """Find trucks within radius, notify their drivers, return broadcast payload."""
    nearby = find_trucks_within_radius(
        db,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        exclude_truck_id=stuck_truck.id,
        only_operational=True,
    )
    truck_to_driver = drivers_for_trucks(db, {n["truck_id"] for n in nearby})
    nearby_driver_ids = set(truck_to_driver.values())

    desc = (description or "").strip()
    title = f"Nearby truck stuck · #{stuck_truck.id} {stuck_truck.plate_number}"
    message = (
        f"Truck #{stuck_truck.id} ({stuck_truck.plate_number}) reported {incident_type} "
        f"within {radius_km} km of you."
    )
    if nearby:
        nearest = nearby[0]
        message += (
            f" Nearest is {nearest['plate_number']} at ~{nearest['distance_km']} km."
        )
    if desc:
        message += f" Details: {desc}"
    message += " You may be asked to assist recovery."

    from app.models.notification import Notification, NotificationType

    for driver_id in nearby_driver_ids:
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            continue
        db.add(
            Notification(
                user_id=driver.user_id,
                type=NotificationType.INCIDENT_ALERT,
                title=title,
                message=message,
                is_read=False,
            )
        )

    payload = {
        "type": "truck_stuck",
        "incident_id": incident_id,
        "radius_km": radius_km,
        "stuck_truck": {
            "truck_id": stuck_truck.id,
            "plate_number": stuck_truck.plate_number,
            "model": stuck_truck.model,
            "lat": lat,
            "lng": lng,
            "incident_type": incident_type,
            "description": description,
            "reported_at": datetime.now(timezone.utc).isoformat(),
        },
        "nearby_trucks": nearby,
        "nearby_driver_ids": sorted(nearby_driver_ids),
        "message": message,
    }
    return payload


async def broadcast_stuck_alert(payload: dict[str, Any]) -> int:
    """Push proximity alert over WebSocket to nearby drivers + map clients."""
    driver_ids = set(payload.get("nearby_driver_ids") or [])
    # Always broadcast full payload to everyone on the map/driver hub;
    # nearby drivers also get a targeted copy.
    await hub.broadcast(payload)
    if driver_ids:
        targeted = {**payload, "targeted": True}
        await hub.broadcast_to_drivers(driver_ids, targeted)
    return len(driver_ids)


def record_truck_location(
    db: Session,
    truck: Truck,
    lat: float,
    lng: float,
    status: str | None = None,
) -> dict[str, Any]:
    """Persist GPS to DB + tracking_logs + Redis, return payload for broadcast."""
    truck.current_lat = lat
    truck.current_lng = lng
    if status:
        truck.status = TruckStatus(status)
    db.add(truck)

    db.add(TrackingLog(truck_id=truck.id, lat=lat, lng=lng))
    db.commit()
    db.refresh(truck)

    payload = {
        "truck_id": truck.id,
        "plate_number": truck.plate_number,
        "model": truck.model,
        "lat": lat,
        "lng": lng,
        "status": truck.status.value if truck.status else None,
        "updated_at": truck.updated_at.isoformat() if truck.updated_at else None,
    }
    store_live_location(payload)
    return payload


def read_truck_location_from_cache_or_db(truck_id: int, db: Session) -> dict | None:
    cached = get_live_location(truck_id)
    if cached:
        return cached
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck or truck.current_lat is None:
        return None
    return {
        "truck_id": truck.id,
        "plate_number": truck.plate_number,
        "model": truck.model,
        "lat": truck.current_lat,
        "lng": truck.current_lng,
        "status": truck.status.value if truck.status else None,
        "updated_at": truck.updated_at.isoformat() if truck.updated_at else None,
    }
