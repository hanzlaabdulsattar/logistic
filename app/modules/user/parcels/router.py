from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer
from app.models.parcel import ParcelStatus
from app.modules.auth.dependencies import get_current_customer_profile
from app.modules.user.parcels import crud
from app.modules.user.parcels.schemas import ParcelResponse

router = APIRouter(prefix="/parcels", tags=["user-parcels"])


@router.get("/", response_model=list[ParcelResponse])
def list_my_parcels(
    skip: int = 0,
    limit: int = 100,
    order_id: int | None = None,
    status: ParcelStatus | None = None,
    customer: Customer = Depends(get_current_customer_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_order_parcels(
        db,
        customer,
        order_id=order_id,
        skip=skip,
        limit=limit,
        status=status.value if status else None,
    )


@router.get("/{parcel_id}", response_model=ParcelResponse)
def get_my_parcel(
    parcel_id: int,
    customer: Customer = Depends(get_current_customer_profile),
    db: Session = Depends(get_db),
):
    return crud.get_my_parcel(db, customer, parcel_id)
