"""Dynamic delivery pricing for orders.

Rules (project):
- Min weight: 3 kg
- Max weight: 45 kg
- Rate: PKR 20 per kilometer
- Max distance: 40 km
- amount = distance_km * RATE_PER_KM
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from fastapi import HTTPException

MIN_WEIGHT_KG = 3.0
RATE_PER_KM = 20.0
RATE_PER_KG = 0.0
BASE_FEE = 0.0
HANDLING_FEE = 0.0
CURRENCY = "PKR"
MIN_DISTANCE_KM = 1.0
MAX_DISTANCE_KM = 40.0
# No maximum weight — only minimum is enforced


@dataclass
class PricingResult:
    weight_kg: float
    distance_km: float
    rate_per_km: float
    rate_per_kg: float
    base_fee: float
    handling_fee: float
    amount: float
    currency: str
    pricing_formula: str


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_pricing(
    *,
    pickup_lat: float,
    pickup_lng: float,
    delivery_lat: float,
    delivery_lng: float,
    weight_kg: float | None,
    amount: float | None = None,
    rate_per_km: float | None = None,
) -> PricingResult:
    """Validate weight/distance and compute (or accept) order pricing snapshot."""
    if weight_kg is None:
        weight_kg = MIN_WEIGHT_KG
    try:
        weight = float(weight_kg)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid parcel weight")

    if weight < MIN_WEIGHT_KG:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order weight is {MIN_WEIGHT_KG} kg",
        )

    raw_km = haversine_km(pickup_lat, pickup_lng, delivery_lat, delivery_lng)
    distance_km = round(max(MIN_DISTANCE_KM, raw_km) * 10) / 10
    if raw_km > MAX_DISTANCE_KM:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Distance limit exceeded — max delivery distance is {MAX_DISTANCE_KM} km "
                f"(this route is {raw_km:.1f} km)"
            ),
        )

    rate = float(rate_per_km) if rate_per_km not in (None, 0) else RATE_PER_KM
    if rate <= 0:
        rate = RATE_PER_KM

    if amount is not None:
        try:
            computed_amount = float(amount)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid order amount")
        if computed_amount < 0:
            raise HTTPException(status_code=400, detail="Order amount cannot be negative")
        # If client sent amount, still record rate/distance; prefer server rate for formula
        total = round(computed_amount * 100) / 100
    else:
        total = round(distance_km * rate * 100) / 100

    formula = f"{distance_km} km × PKR {rate:.0f}/km = PKR {total:.2f}"
    return PricingResult(
        weight_kg=round(weight, 2),
        distance_km=distance_km,
        rate_per_km=rate,
        rate_per_kg=RATE_PER_KG,
        base_fee=BASE_FEE,
        handling_fee=HANDLING_FEE,
        amount=total,
        currency=CURRENCY,
        pricing_formula=formula,
    )
