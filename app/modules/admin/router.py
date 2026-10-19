from fastapi import Depends

from app.modules.admin.customers.router import router as customers_router
from app.modules.admin.dashboard.router import router as dashboard_router
from app.modules.admin.drivers.router import router as drivers_router
from app.modules.admin.incidents.router import router as incidents_router
from app.modules.admin.maintenance.router import router as maintenance_router
from app.modules.admin.orders.router import router as orders_router
from app.modules.admin.parcels.router import router as parcels_router
from app.modules.admin.recovery.router import router as recovery_router
from app.modules.admin.trucks.router import router as trucks_router
from app.modules.admin.users.router import router as users_router
from app.modules.auth.dependencies import require_admin
from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

router.include_router(dashboard_router)
router.include_router(trucks_router)
router.include_router(drivers_router)
router.include_router(orders_router)
router.include_router(incidents_router)
router.include_router(customers_router)
router.include_router(parcels_router)
router.include_router(recovery_router)
router.include_router(users_router)
router.include_router(maintenance_router)
