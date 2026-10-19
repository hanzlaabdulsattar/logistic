from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import require_driver
from app.modules.driver.deliveries.router import router as deliveries_router
from app.modules.driver.incidents.router import router as incidents_router
from app.modules.driver.notifications.router import router as notifications_router
from app.modules.driver.profile.router import router as profile_router
from app.modules.driver.recovery.router import router as recovery_router
from app.modules.driver.truck.router import router as truck_router

router = APIRouter(
    prefix="/driver",
    tags=["driver"],
    dependencies=[Depends(require_driver)],
)

router.include_router(profile_router)
router.include_router(truck_router)
router.include_router(deliveries_router)
router.include_router(incidents_router)
router.include_router(recovery_router)
router.include_router(notifications_router)
