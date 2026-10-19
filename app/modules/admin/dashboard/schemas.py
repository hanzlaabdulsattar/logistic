from datetime import datetime

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_trucks: int
    total_drivers: int
    total_orders: int
    total_parcels: int
    total_customers: int
    active_incidents: int
    available_trucks: int
    available_drivers: int
    breakdown_trucks: int
    pending_orders: int
    in_transit_orders: int
    delivered_orders: int
    pending_recovery_requests: int


class LiveMapTruck(BaseModel):
    id: int
    plate_number: str
    model: str
    status: str
    current_lat: float | None
    current_lng: float | None
    source: str = "db"  # db | redis
    updated_at: str | None = None


class RecentIncident(BaseModel):
    id: int
    truck_id: int
    driver_id: int
    type: str
    status: str
    lat: float
    lng: float
    created_at: datetime


class DashboardOverview(BaseModel):
    stats: DashboardStats
    live_map: list[LiveMapTruck]
    recent_incidents: list[RecentIncident]
    live_source: str = "db"  # redis | db
    websocket_path: str = "/ws/live-map"


class LocationPoint(BaseModel):
    id: int
    truck_id: int
    lat: float
    lng: float
    timestamp: datetime


class LiveLocationPayload(BaseModel):
    truck_id: int
    lat: float
    lng: float
    status: str | None = None
    plate_number: str | None = None
    model: str | None = None
    updated_at: str | None = None
    source: str = "redis"
