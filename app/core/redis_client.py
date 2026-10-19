from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis

from app.core.config import settings

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _redis_client


def redis_available() -> bool:
    try:
        return bool(get_redis().ping())
    except Exception:
        return False


LIVE_LOCATION_KEY = "truck:live_locations"
LIVE_CHANNEL = "truck:location_updates"
LOCATION_TTL_SECONDS = 60 * 60 * 24


def _location_payload(
    truck_id: int,
    lat: float,
    lng: float,
    status: str | None,
    plate_number: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    return {
        "truck_id": truck_id,
        "lat": lat,
        "lng": lng,
        "status": status,
        "plate_number": plate_number,
        "model": model,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def store_live_location(payload: dict[str, Any]) -> None:
    """Cache latest truck position in Redis hash + pub/sub channel."""
    try:
        r = get_redis()
        truck_id = str(payload["truck_id"])
        r.hset(LIVE_LOCATION_KEY, truck_id, json.dumps(payload))
        r.expire(LIVE_LOCATION_KEY, LOCATION_TTL_SECONDS)
        r.publish(LIVE_CHANNEL, json.dumps(payload))
    except Exception:
        # Redis optional — DB remains source of truth
        pass


def get_live_locations() -> list[dict[str, Any]]:
    try:
        r = get_redis()
        raw = r.hgetall(LIVE_LOCATION_KEY)
        items = []
        for value in raw.values():
            try:
                items.append(json.loads(value))
            except json.JSONDecodeError:
                continue
        items.sort(key=lambda x: x.get("truck_id", 0))
        return items
    except Exception:
        return []


def get_live_location(truck_id: int) -> dict[str, Any] | None:
    try:
        raw = get_redis().hget(LIVE_LOCATION_KEY, str(truck_id))
        return json.loads(raw) if raw else None
    except Exception:
        return None
