from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import require_customer
from app.modules.user.notifications.router import router as notifications_router
from app.modules.user.orders.router import router as orders_router
from app.modules.user.parcels.router import router as parcels_router
from app.modules.user.profile.router import router as profile_router

router = APIRouter(
    prefix="/user",
    tags=["user"],
    dependencies=[Depends(require_customer)],
)

router.include_router(profile_router)
router.include_router(orders_router)
router.include_router(parcels_router)
router.include_router(notifications_router)
