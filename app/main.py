from __future__ import annotations

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings
from app.core.location import hub
from app.core.redis_client import redis_available
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.driver.router import router as driver_router
from app.modules.payments.router import orders_payment_router, router as payments_router
from app.modules.user.router import router as user_router

app = FastAPI(title=settings.app_name)

allow_origins = settings.cors_origin_list
allow_all = allow_origins == ["*"]

ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "QUERY"]


def _origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if allow_all or origin == "null":
        return True
    return origin in allow_origins


class DevCORSMiddleware(BaseHTTPMiddleware):
    """CORS for local frontend development."""

    def _headers(self, origin: str | None) -> dict[str, str]:
        headers = {
            "Access-Control-Allow-Methods": ", ".join(ALLOW_METHODS),
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Requested-With",
            "Access-Control-Expose-Headers": "*",
            "Access-Control-Max-Age": "600",
        }
        if origin and _origin_allowed(origin):
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
            headers["Vary"] = "Origin"
        return headers

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")

        if request.method == "OPTIONS":
            if origin and not _origin_allowed(origin):
                return Response(
                    status_code=400,
                    content="CORS origin not allowed",
                    media_type="text/plain",
                )
            return Response(status_code=200, content="OK", headers=self._headers(origin))

        response = await call_next(request)

        if origin and _origin_allowed(origin):
            for key, value in self._headers(origin).items():
                response.headers[key] = value
        return response


app.add_middleware(DevCORSMiddleware)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(driver_router)
app.include_router(user_router)
app.include_router(payments_router)
app.include_router(orders_payment_router)


def _extract_token(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token") or websocket.headers.get("authorization")
    if token and token.lower().startswith("bearer "):
        token = token[7:]
    return token


def _decode_user_id(token: str | None) -> int | None:
    if not token:
        return None
    try:
        from jose import JWTError, jwt

        from app.modules.auth.security import auth_settings

        payload = jwt.decode(token, auth_settings.secret_key, algorithms=[auth_settings.algorithm])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except Exception:
        return None


def _driver_id_for_user(user_id: int | None) -> int | None:
    if user_id is None:
        return None
    from app.core.database import SessionLocal
    from app.models.driver import Driver

    db = SessionLocal()
    try:
        row = db.query(Driver).filter(Driver.user_id == user_id).first()
        return row.id if row else None
    finally:
        db.close()


@app.on_event("startup")
async def _startup_live_location() -> None:
    await hub.ensure_redis_listener()


@app.websocket("/ws/live-map")
async def websocket_live_map(websocket: WebSocket):
    """Live truck GPS + stuck-truck proximity alerts (admin map / any client)."""
    token = _extract_token(websocket)
    user_id = _decode_user_id(token)
    if token and user_id is None:
        await websocket.close(code=4401)
        return
    await hub.connect(websocket, driver_id=None)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket)
    except Exception:
        hub.disconnect(websocket)


@app.websocket("/ws/driver")
async def websocket_driver(websocket: WebSocket):
    """Driver channel: receive nearby stuck-truck alerts (10km) in real time."""
    token = _extract_token(websocket)
    user_id = _decode_user_id(token)
    if token and user_id is None:
        await websocket.close(code=4401)
        return
    driver_id = _driver_id_for_user(user_id)
    # Even without driver profile, connect as generic driver listener
    await hub.connect(websocket, driver_id=driver_id if driver_id is not None else -1)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket, driver_id=driver_id if driver_id is not None else -1)
    except Exception:
        hub.disconnect(websocket, driver_id=driver_id if driver_id is not None else -1)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "environment": settings.environment,
        "cors_allow_all": allow_all,
        "cors_origins": allow_origins if not allow_all else ["* (CORS_ALLOW_ALL)"],
        "redis": "up" if redis_available() else "down",
        "websocket_paths": ["/ws/live-map", "/ws/driver"],
        "nearby_radius_km": 10,
    }
