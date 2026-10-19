# Frontend integration notes

These constraints are part of the project and drive how the React client is built.

## 1. Live map = REST polling (not WebSocket/Redis yet)

Documentation describes real-time channels:

- `/ws/admin` — fleet coordinates + incidents
- `/ws/driver/{driver_id}` — emergency recovery + route updates
- `/ws/customer/{customer_id}` — parcel / order status pushes
- Redis Pub/Sub for notifications

**Current backend does not implement those WebSocket routes or Redis streaming.**

The React frontend therefore:

1. Polls REST endpoints on an interval (`src/utils/usePolling.ts`).
2. Shows a **REST poll** banner on dashboards so operators know updates are periodic.
3. Lets the admin pause/resume auto-refresh.

| UI | REST endpoint used for “live” data | Poll interval |
|----|--------------------------------------|---------------|
| Admin live map + stats | `GET /admin/dashboard/overview` (includes `live_map`) | 5s |
| Driver ops | profile + deliveries + recovery requests | 6s |
| Customer feed | orders + notifications | 8s |

**When WebSockets are added later**, keep the same component data props and replace the
polling hook with socket event handlers. Do not invent fake push channels.

## 2. Test logins (seed data)

`scripts/seed_admin.py` creates demo users used by the frontend Login page:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | admin123 |
| Driver | driver@test.com | driver123 |
| Customer | customer@test.com | customer123 |

The login UI offers one-click chips for these accounts.

Re-seed if the DB is empty:

```bash
cd /home/hanzlamayo/Desktop/logistic
.venv/bin/python scripts/seed_admin.py
```

## 3. CORS when the frontend runs on another port

Backend: `app/main.py`

- Default allow-list includes common local frontend ports:
  - `3000`, `4173`, `5000`, `5173`, `8000` on `localhost` and `127.0.0.1`
- Override for a custom port:

```bash
CORS_ORIGINS=http://localhost:5180,http://127.0.0.1:5180 \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- Local-only open CORS (disables credentials because browsers reject `*` + credentials):

```bash
CORS_ALLOW_ALL=true \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Vite dev server also proxies auth/admin/driver/user paths to `http://127.0.0.1:8000`
(`frontend/vite.config.ts`), so same-origin proxying works without CORS for those routes.

Frontend API base can be changed with `VITE_API_BASE_URL` in `frontend/.env`.

## 4. Browser Geolocation

Driver incident reporting uses the **Browser Geolocation API** (no paid Maps key for
coordinates). Coordinates are submitted to:

- `POST /driver/incidents/` (driver)
- Admin incident form can also enter lat/lng manually

Truck `current_lat` / `current_lng` currently come from truck records / admin updates.
A dedicated `POST /vehicles/{id}/location` ingest endpoint is documented but not yet in
the backend; when it lands, wire driver location streaming to that API then.
