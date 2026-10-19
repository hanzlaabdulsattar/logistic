from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.modules.auth.dependencies import get_current_customer_profile, get_current_user
from app.modules.user.profile import crud
from app.modules.user.profile.schemas import CustomerUserOut, ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["user-profile"])


def _profile_response(customer: Customer, user: User) -> ProfileResponse:
    return ProfileResponse(
        id=customer.id,
        user_id=customer.user_id,
        address=customer.address,
        user=CustomerUserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role.value,
        ),
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    customer: Customer = Depends(get_current_customer_profile),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = crud.get_user(db, current_user.id) or current_user
    return _profile_response(customer, user)


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    profile_in: ProfileUpdate,
    customer: Customer = Depends(get_current_customer_profile),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = crud.update_profile(db, customer, current_user, profile_in)
    user = crud.get_user(db, current_user.id) or current_user
    return _profile_response(customer, user)
