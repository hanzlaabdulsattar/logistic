from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.location import hub
from app.core.redis_client import get_live_locations, redis_available
from app.models.customer import Customer
from app.models.driver import Driver, DriverStatus
from app.models.incident import Incident, IncidentStatus
from app.models.order import Order, OrderStatus
from app.models.parcel import Parcel
from app.models.recovery_request import RecoveryRequest, RecoveryRequestStatus
from app.models.tracking_log import TrackingLog
from app.models.truck import Truck, TruckStatus
from app.modules.admin.dashboard.schemas import (
    DashboardOverview,
    DashboardStats,
    LiveLocationPayload,
    LiveMapTruck,
    LocationPoint,
    RecentIncident,
)

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


def _build_stats(db: Session) -> DashboardStats:
    return DashboardStats(
        total_trucks=db.query(Truck).count(),
        total_drivers=db.query(Driver).count(),
        total_orders=db.query(Order).count(),
        total_parcels=db.query(Parcel).count(),
        total_customers=db.query(Customer).count(),
        active_incidents=db.query(Incident)
        .filter(
            Incident.status.in_(
                [IncidentStatus.REPORTED, IncidentStatus.RECOVERY_IN_PROGRESS]
            )
        )
        .count(),
        available_trucks=db.query(Truck)
        .filter(Truck.status == TruckStatus.AVAILABLE)
        .count(),
        available_drivers=db.query(Driver)
        .filter(Driver.status == DriverStatus.AVAILABLE)
        .count(),
        breakdown_trucks=db.query(Truck)
        .filter(Truck.status == TruckStatus.BREAKDOWN)
        .count(),
        pending_orders=db.query(Order)
        .filter(Order.status == OrderStatus.PENDING)
        .count(),
        in_transit_orders=db.query(Order)
        .filter(Order.status == OrderStatus.IN_TRANSIT)
        .count(),
        delivered_orders=db.query(Order)
        .filter(Order.status == OrderStatus.DELIVERED)
        .count(),
        pending_recovery_requests=db.query(RecoveryRequest)
        .filter(RecoveryRequest.status == RecoveryRequestStatus.PENDING)
        .count(),
    )


def _live_map_trucks(db: Session) -> tuple[list[LiveMapTruck], str]:
    """Prefer Redis live positions; fall back to trucks table."""
    redis_locs = {int(x["truck_id"]): x for x in get_live_locations() if x.get("truck_id") is not None}
    trucks = db.query(Truck).all()
    result: list[LiveMapTruck] = []
    source = "redis" if redis_locs else "db"
    for t in trucks:
        cached = redis_locs.get(t.id)
        if cached and cached.get("lat") is not None:
            result.append(
                LiveMapTruck(
                    id=t.id,
                    plate_number=t.plate_number,
                    model=t.model,
                    status=cached.get("status") or t.status.value,
                    current_lat=float(cached["lat"]),
                    current_lng=float(cached["lng"]),
                    source="redis",
                    updated_at=cached.get("updated_at"),
                )
            )
        else:
            result.append(
                LiveMapTruck(
                    id=t.id,
                    plate_number=t.plate_number,
                    model=t.model,
                    status=t.status.value,
                    current_lat=t.current_lat,
                    current_lng=t.current_lng,
                    source="db",
                    updated_at=t.updated_at.isoformat() if t.updated_at else None,
                )
            )
    return result, source


def _recent_incidents(db: Session, limit: int = 10) -> list[RecentIncident]:
    incidents = (
        db.query(Incident).order_by(Incident.created_at.desc()).limit(limit).all()
    )
    return [
        RecentIncident(
            id=i.id,
            truck_id=i.truck_id,
            driver_id=i.driver_id,
            type=i.type.value,
            status=i.status.value,
            lat=i.lat,
            lng=i.lng,
            created_at=i.created_at,
        )
        for i in incidents
    ]


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    return _build_stats(db)


@router.get("/live-map", response_model=list[LiveMapTruck])
def get_live_map_data(db: Session = Depends(get_db)):
    trucks, _ = _live_map_trucks(db)
    return trucks


@router.get("/live-locations", response_model=list[LiveLocationPayload])
def get_live_locations_endpoint():
    """Latest GPS from Redis cache (fast path for maps)."""
    items = get_live_locations()
    return [
        LiveLocationPayload(
            truck_id=int(x["truck_id"]),
            lat=float(x["lat"]),
            lng=float(x["lng"]),
            status=x.get("status"),
            plate_number=x.get("plate_number"),
            model=x.get("model"),
            updated_at=x.get("updated_at"),
            source="redis",
        )
        for x in items
        if x.get("lat") is not None
    ]


@router.get("/trucks/{truck_id}/location-history", response_model=list[LocationPoint])
def truck_location_history(
    truck_id: int,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """GPS trail from tracking_logs."""
    truck = db.query(Truck).filter(Truck.id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    rows = (
        db.query(TrackingLog)
        .filter(TrackingLog.truck_id == truck_id)
        .order_by(TrackingLog.timestamp.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [
        LocationPoint(
            id=r.id,
            truck_id=r.truck_id,
            lat=r.lat,
            lng=r.lng,
            timestamp=r.timestamp,
        )
        for r in rows
    ]


@router.get("/overview", response_model=DashboardOverview)
def get_overview(db: Session = Depends(get_db)):
    live_map, source = _live_map_trucks(db)
    return DashboardOverview(
        stats=_build_stats(db),
        live_map=live_map,
        recent_incidents=_recent_incidents(db),
        live_source=source if redis_available() else "db",
        websocket_path="/ws/live-map",
    )
