from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.vehicle_maintenance import MaintenanceStatus
from app.modules.admin.maintenance import crud
from app.modules.admin.maintenance.schemas import (
    MaintenanceCreate,
    MaintenanceResponse,
    MaintenanceUpdate,
)

router = APIRouter(prefix="/maintenance", tags=["admin-maintenance"])


@router.get("/", response_model=list[MaintenanceResponse])
def list_maintenance(
    skip: int = 0,
    limit: int = 100,
    truck_id: int | None = None,
    status: MaintenanceStatus | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_maintenance_records(
        db,
        skip=skip,
        limit=limit,
        truck_id=truck_id,
        status=status.value if status else None,
    )


@router.post("/", response_model=MaintenanceResponse)
def create_maintenance(record_in: MaintenanceCreate, db: Session = Depends(get_db)):
    return crud.create_maintenance_record(db, record_in=record_in)


@router.get("/{record_id}", response_model=MaintenanceResponse)
def get_maintenance(record_id: int, db: Session = Depends(get_db)):
    record = crud.get_maintenance_record(db, record_id=record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return record


@router.put("/{record_id}", response_model=MaintenanceResponse)
def update_maintenance(
    record_id: int, record_in: MaintenanceUpdate, db: Session = Depends(get_db)
):
    record = crud.update_maintenance_record(db, record_id=record_id, record_in=record_in)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return record


@router.delete("/{record_id}")
def delete_maintenance(record_id: int, db: Session = Depends(get_db)):
    if not crud.delete_maintenance_record(db, record_id=record_id):
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return {"message": "Maintenance record deleted successfully"}
