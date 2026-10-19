# Logistics Platform — One-Page Viva Cheat Sheet

## Project
**AI-Powered Real-Time Logistics Management & Vehicle Recovery System**

| | |
|--|--|
| **Users** | Admin · Driver · Customer |
| **Backend** | FastAPI + SQLAlchemy 2.0 + PostgreSQL 16 + Redis 7 · Alembic · `http://127.0.0.1:8000` |
| **Frontend** | React 18 + TS + Vite · Axios · React-Leaflet/OSM · `http://127.0.0.1:5173` |
| **Auth** | bcrypt + Bearer JWT (HS256, 30 min) + RBAC dependencies |
| **Real-time** | WebSockets `/ws/live-map`, `/ws/driver` fed by Redis Pub/Sub · REST polling fallback |

---

## Order flow (one line)
```
Customer create (price quote) → Auto/Admin assign → Driver Accept/Reject → START GPS
→ live map (WS + poll) → PAUSE/Stop → Deliver → Pay (COD / SafePay)
```

---

## Pricing (`user/orders/pricing.py`)
- Distance = **Haversine** (pickup → delivery), min 1 km, **max 40 km**
- Weight **min 3 kg** (no max)
- **Amount = distance_km × PKR 20** · formula string stored on order

---

## Assignment hierarchy (`user/orders/assignment.py`)
1. **Admin manual pick** (always wins)
2. **Auto sort key:** AVAILABLE before ON_DELIVERY → has truck → **least open orders** → lower ID
3. **Bulk:** urgent → high → normal → low, then least-loaded
4. **Reject:** auto again, skipping the rejector
5. No eligible driver → stays unassigned for admin

Open orders = pending + assigned + in_transit · reassignments audited in `order_reassignments`

---

## Location tracking (core technical point)

| Step | What happens |
|------|----------------|
| Driver **START** | `navigator.geolocation.watchPosition` |
| Every **5s** | `POST /driver/trucks/{id}/location` `{lat,lng,status}` |
| DB | `trucks.current_lat/lng` + row in `tracking_logs` (history) |
| Redis | `HSET truck:live_locations` (latest cache) + `PUBLISH truck:location_updates` |
| Push | Startup task subscribes to Redis → `LocationHub.broadcast()` → all WebSockets |
| Admin map | `/ws/live-map`: snapshot on connect, then live `location` frames; poll 5s fallback |
| Customer order | Poll `GET /user/orders/{id}` every **4s** → Leaflet map + `journey_phase` |
| **PAUSE** | GPS off · truck `available` · customer sees **Stopped** at last point |

**Why Redis?** Fast in-memory latest-position cache + Pub/Sub fan-out.  
**Redis down?** Every Redis call is try/except — Postgres stays source of truth, UI falls back to polling.  
**Map tiles?** OpenStreetMap + Leaflet (no paid Google key).  
**Demo without moving?** `python simulator/truck_simulator.py` (Lahore → Islamabad path).

---

## Breakdown → nearby-driver alert (10 km)
```
Driver reports incident → truck = BREAKDOWN
→ Haversine: operational trucks within 10 km
→ DB notification to their drivers
→ WS "truck_stuck" to all map clients + targeted copy on /ws/driver
```

---

## Statuses
| Entity | Values |
|--------|--------|
| Order | pending → assigned → in_transit → delivered · also cancelled, reassigned |
| Truck | available · in_transit · breakdown · maintenance · off_duty |
| Driver | available · on_delivery · on_leave · suspended |
| Priority | low · normal · high · urgent |
| Payment | pending · processing · paid · failed · cancelled · refunded |
| Journey phase (customer) | awaiting_accept · on_the_way · stopped · delivered · cancelled |

---

## Main APIs
```
POST /auth/login | register
POST /user/orders/                    create + price + parcel + auto-assign + notify
GET  /user/orders/{id}                driver + GPS + journey_phase
POST /user/orders/{id}/cancel
PUT  /admin/orders/{id}/assign-driver manual/auto assign
POST /admin/orders/{id}/reassign      move driver + audit
POST /admin/orders/assign-unassigned  bulk hierarchy
GET  /admin/orders/driver-workload    open counts
GET  /driver/deliveries/incoming      offers
POST /driver/deliveries/{id}/accept|reject
POST /driver/trucks/{id}/location     GPS ingest → DB + Redis + WS
POST /driver/incidents/               report → 10 km proximity alert
GET  /driver/incidents/nearby         trucks near me
POST /payments/cod | /payments/safe-pay
GET|POST /payments/safepay/return     SafePay redirect → verify HMAC → paid
POST /payments/safepay/webhook        X-SFPY-SIGNATURE verified webhook
POST /payments/{id}/mark-paid         admin, or customer in demo mode only
WS   /ws/live-map | /ws/driver
GET  /health                          redis up/down, ws paths
```

---

## Roles — what each screen does

| Role | Key screens |
|------|-------------|
| **Admin** | Dashboard (stats + live WS map), Orders (assign/reassign/workload), Trucks, Drivers, Customers, Users, Parcels, Incidents, Maintenance, Recovery (read-only) |
| **Driver** | Incoming Accept/Reject, START/PAUSE GPS, Deliveries, Incidents + live nearby alerts |
| **Customer** | Create order (price + priority), track map, pay (COD/SafePay), parcels, notifications, profile |

---

## Payments (SafePay + COD)
```
POST /payments/safe-pay → SafePay /order/v1/init (tracker) → hosted checkout
→ SafePay POSTs back tracker+sig → server checks sig == HMAC-SHA256(secret, tracker) → paid
```
- Amount always from server-side order pricing (client amount ignored)
- Ownership checked on every payment endpoint · double payment → 409
- COD → marked paid automatically when driver sets order delivered
- No keys in `.env` → demo checkout page (no real charge)

---

## Test logins
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | admin123 |
| Customer | customer@test.com | customer123 |
| Driver | driver@test.com | driver123 |

---

## Implemented vs Not (honest)

| Done | Not done / partial |
|------|-------------------------|
| Full order CRUD + priority + pricing + hierarchy | AI recovery agent (no LLM; `RecoveryRequest` never created) |
| Driver accept/reject + GPS START/PAUSE | Parcel-transfer automation (model only) |
| **WebSockets + Redis Pub/Sub live map** | |
| **10 km stuck-truck proximity alerts** | Microservices + Nginx (monolith today) |
| Payments: SafePay (signed redirect + webhook) + COD | Unit tests (`tests/unit/` empty) |
| Notifications, maintenance, Alembic migrations, GPS simulator | |

**Known hardening TODOs:** default JWT secret if `AUTH_SECRET_KEY` unset · WebSockets accept connections without a token.

---

## 60-second demo script
1. Start simulator or driver START → Admin dashboard: truck moves live (WS)
2. Customer → Create order (priority High, see price)
3. Admin → order auto-assigned (workload table)
4. Driver → Accept → START (allow location)
5. Customer → Order detail → **map + On the way**
6. Driver → report breakdown → nearby driver gets **truck_stuck** alert
7. Customer pays (SafePay or COD) → driver delivered → COD auto-settled

---

## Closing sentence
> React + FastAPI logistics platform: customers book priced orders, drivers accept/reject and stream browser GPS, positions flow through Postgres + Redis Pub/Sub to WebSocket maps, and breakdowns alert drivers within 10 km — SafePay payments are verified server-side; the AI recovery agent remains future work.
