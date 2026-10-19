from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.parcel import ParcelStatus
from app.modules.admin.parcels import crud
from app.modules.admin.parcels.schemas import ParcelCreate, ParcelResponse, ParcelUpdate

router = APIRouter(prefix="/parcels", tags=["admin-parcels"])


@router.get("/", response_model=list[ParcelResponse])
def list_parcels(
    skip: int = 0,
    limit: int = 100,
    order_id: int | None = None,
    truck_id: int | None = None,
    status: ParcelStatus | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_parcels(
        db,
        skip=skip,
        limit=limit,
        order_id=order_id,
        truck_id=truck_id,
        status=status.value if status else None,
    )


@router.post("/", response_model=ParcelResponse)
def create_parcel(parcel_in: ParcelCreate, db: Session = Depends(get_db)):
    return crud.create_parcel(db, parcel_in=parcel_in)


@router.get("/{parcel_id}", response_model=ParcelResponse)
def get_parcel(parcel_id: int, db: Session = Depends(get_db)):
    parcel = crud.get_parcel(db, parcel_id=parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return parcel


@router.put("/{parcel_id}", response_model=ParcelResponse)
def update_parcel(parcel_id: int, parcel_in: ParcelUpdate, db: Session = Depends(get_db)):
    parcel = crud.update_parcel(db, parcel_id=parcel_id, parcel_in=parcel_in)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return parcel


@router.delete("/{parcel_id}")
def delete_parcel(parcel_id: int, db: Session = Depends(get_db)):
    if not crud.delete_parcel(db, parcel_id=parcel_id):
        raise HTTPException(status_code=404, detail="Parcel not found")
    return {"message": "Parcel deleted successfully"}
