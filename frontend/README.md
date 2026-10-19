# Logistics Frontend (React)

Role-based web client for the FastAPI logistics backend.

## Stack
- React 18 + TypeScript + Vite
- React Router
- Axios (Bearer JWT)
- **Map: React + React-Leaflet + OpenStreetMap** (admin fleet map + customer order tracking)
- Browser Geolocation API (driver incident/journey location)
- **REST polling** for “live” dashboards (WebSocket/Redis not ready yet)

## Base URL
Default API base: `http://127.0.0.1:8000`  
Override with `VITE_API_BASE_URL` in `.env`.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite prints).

## Backend must be running

```bash
cd /home/hanzlamayo/Desktop/logistic
docker compose up -d
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# optional seed data
.venv/bin/python scripts/seed_admin.py
```

## CORS (frontend on a different port)

The backend (`app/main.py`) enables CORS so the React app can call `http://127.0.0.1:8000`
from another origin (Vite `5173`, preview `4173`, CRA `3000`, etc.).

Defaults already allow common local ports. For another port:

```bash
# Comma-separated allow-list (recommended)
CORS_ORIGINS=http://localhost:5180,http://127.0.0.1:5180 \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Or allow any origin for local-only experiments
# (credentials are disabled when origins = *)
CORS_ALLOW_ALL=true \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Vite also proxies `/auth`, `/admin`, `/driver`, `/user`, `/health` to `127.0.0.1:8000`
so the same-origin path works without CORS when using the dev server.

## Live map / dashboards = REST polling

Project docs mention WebSockets (`/ws/admin`, `/ws/driver/{id}`, `/ws/customer/{id}`)
and Redis Pub/Sub. Those are **not implemented on the backend yet**.

Until then the frontend polls REST endpoints:

| Screen | Endpoint | Interval |
|--------|----------|----------|
| Admin dashboard + live map | `GET /admin/dashboard/overview` | 5s |
| Driver dashboard | `GET /driver/profile/me`, deliveries, recovery requests | 6s |
| Customer dashboard / notifications | `GET /user/orders/`, `GET /user/notifications/` | 8s |

Use the **Live polling** / **Polling paused** toggle on the admin dashboard, or the
Refresh buttons, to control auto-refresh manually.

When WebSocket/Redis arrive later, swap `usePolling` for socket handlers — UI data shapes
will not change.

## Test accounts (seed)

These are also clickable on the **Login** page (one-click fill + sign-in).

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@test.com` | `admin123` |
| Driver | `driver@test.com` | `driver123` |
| Customer | `customer@test.com` | `customer123` |

Seed command: `.venv/bin/python scripts/seed_admin.py`

## Role dashboards

### Admin (`/admin`)
- Dashboard stats + live vehicle map (REST-poll) + recent incidents
- Trucks / Drivers / Orders / Incidents / Recovery / Parcels / Customers / Maintenance / Users

### Driver (`/driver`)
- Journey controls (Start / Pause / Incident)
- Assigned deliveries + status updates
- Incident reporting with browser geolocation
- Recovery request Accept / Reject (emergency assist)

### Customer (`/customer`)
- Create / track / cancel orders
- View parcels
- Notifications
- Profile

## Auth
- `POST /auth/login` → JWT `access_token`
- Token stored in `localStorage` and sent as `Authorization: Bearer <token>`
- Role-based route guards redirect after login
