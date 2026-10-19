from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.truck import TruckStatus
from app.modules.admin.trucks import crud
from app.modules.admin.trucks.schemas import TruckCreate, TruckResponse, TruckUpdate

router = APIRouter(prefix="/trucks", tags=["admin-trucks"])


@router.get("/", response_model=list[TruckResponse])
def list_trucks(
    skip: int = 0,
    limit: int = 100,
    status: TruckStatus | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_trucks(
        db, skip=skip, limit=limit, status=status.value if status else None
    )


@router.post("/", response_model=TruckResponse)
def create_truck(truck_in: TruckCreate, db: Session = Depends(get_db)):
    return crud.create_truck(db, truck_in=truck_in)


@router.get("/{truck_id}", response_model=TruckResponse)
def get_truck(truck_id: int, db: Session = Depends(get_db)):
    truck = crud.get_truck(db, truck_id=truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return truck


@router.put("/{truck_id}", response_model=TruckResponse)
def update_truck(truck_id: int, truck_in: TruckUpdate, db: Session = Depends(get_db)):
    truck = crud.update_truck(db, truck_id=truck_id, truck_in=truck_in)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    return truck


@router.delete("/{truck_id}")
def delete_truck(truck_id: int, db: Session = Depends(get_db)):
    if not crud.delete_truck(db, truck_id=truck_id):
        raise HTTPException(status_code=404, detail="Truck not found")
    return {"message": "Truck deleted successfully"}
