# Viva Slide Outline — Logistics Platform

**Suggested time:** 8–12 minutes + demo  
**File for notes:** `docs/VIVA_CHEAT_SHEET.md`

---

## Slide 1 — Title
- Project name: AI-Powered Real-Time Logistics Management & Vehicle Recovery System  
- Stack line: FastAPI · React · PostgreSQL · Redis · WebSockets · JWT · React-Leaflet/OSM · Browser Geolocation  
- Team / date

---

## Slide 2 — Problem
- Traditional logistics: manual recovery when a truck breaks down  
- Drivers, vehicles, orders, customers live in separate tools  
- Customer cannot see live delivery status  

**Solution in one line:** one platform for fleet + orders + driver ops + customer tracking, with smart assignment, live GPS push and nearby-driver breakdown alerts.

---

## Slide 3 — Users & Roles
| Role | Capabilities |
|------|----------------|
| Admin | Fleet, drivers, customers, orders, assign/reassign, maintenance, incidents, live map |
| Driver | Accept/reject jobs, START/PAUSE GPS, report incidents, receive 10 km alerts |
| Customer | Book priced orders, track driver on map, pay (SafePay / COD), notifications |

---

## Slide 4 — System Architecture
```
React + Vite (5173)
   │  HTTP + JWT Bearer           ▲ WebSocket /ws/live-map, /ws/driver
   ▼                              │
FastAPI monolith (8000) ── LocationHub ◀── Redis Pub/Sub (truck:location_updates)
   │  Auth / Admin / Driver / User / Payments routers        ▲
   ▼                                                         │
PostgreSQL (source of truth)        Redis hash (latest GPS cache)
```

**Note for examiner:** single FastAPI app (modular routers), not microservices. Redis is optional — if down, Postgres + REST polling keep everything working.

---

## Slide 5 — Tech Stack (Why)
| Tech | Why |
|------|-----|
| FastAPI + Pydantic | Async (WebSockets), validation, OpenAPI `/docs` |
| SQLAlchemy 2.0 + Alembic | Typed ORM models, versioned schema migrations |
| PostgreSQL | Relational order↔driver↔truck↔parcel with FKs |
| Redis | In-memory latest-location cache + Pub/Sub fan-out |
| JWT + bcrypt | Stateless auth, salted password hashes |
| React + Vite + TS | Role dashboards, fast dev, typed API payloads |
| Axios | Interceptor adds Bearer token, handles 401 |
| Leaflet + OSM | Free map tiles, no API key |
| Browser Geolocation | Free GPS coords (no paid Maps key) |
| Docker Compose | One-command Postgres + Redis |

---

## Slide 6 — Auth & RBAC
1. Register with role → bcrypt hash stored  
2. Login → JWT (`sub=user_id`, HS256, 30 min)  
3. Axios interceptor adds `Authorization: Bearer …`  
4. FastAPI dependencies: `require_admin` / `require_driver` / `require_customer` → 403 on wrong role  
5. Customer profile auto-created; driver profile linked by admin  

---

## Slide 7 — Order Lifecycle & Pricing
```
Create (price) → Assign → Accept/Reject → START (GPS) → Track → Deliver / Cancel → Pay
```

- **Pricing:** Haversine distance × **PKR 20/km** · min weight 3 kg · max distance 40 km  
- **Priority:** low / normal / high / urgent  
- **Side effects:** parcel + notifications on create  

---

## Slide 8 — How a Driver Is Chosen
```
1. Admin manual pick     → wins
2. Auto hierarchy (sort key):
   AVAILABLE first → has truck → least open orders → lower ID
3. Bulk: urgent → high → normal → low → least-loaded
4. Reject → auto again (skip rejector)
```

Open orders = pending + assigned + in_transit · reassignments audited  

**Demo proof:** multiple orders spread across drivers, not all on Driver #1.

---

## Slide 9 — Location Tracking (Deep Dive)
| Step | Implementation |
|------|----------------|
| START | Browser `watchPosition` |
| Upload | `POST /driver/trucks/{id}/location` every 5s |
| Store | `trucks.current_lat/lng` + `tracking_logs` history |
| Cache + publish | Redis `HSET truck:live_locations` + `PUBLISH truck:location_updates` |
| Push | Startup task subscribes → `LocationHub.broadcast()` to WebSockets |
| Admin map | `/ws/live-map`: snapshot on connect, then live updates (poll 5s fallback) |
| Customer | Poll order API every 4s → Leaflet markers + `journey_phase` |
| PAUSE | Stop GPS · truck available · show **Stopped** |

**Keywords:** Geolocation API · Redis Pub/Sub · WebSocket · graceful degradation · OSM  
**Demo tool:** `simulator/truck_simulator.py` posts a Lahore → Islamabad route.

---

## Slide 10 — Breakdown & Nearby Alerts
```
Driver reports incident → truck status = BREAKDOWN
→ Haversine search: operational trucks within 10 km
→ DB notification for their drivers
→ WS "truck_stuck": all map clients + targeted copy on /ws/driver
```
- Admin sees incident on map; nearby drivers get a real-time popup  
- Recovery request / response / parcel-transfer tables exist for the next step  

---

## Slide 11 — Customer Experience
- Create order (addresses + geolocation buttons + priority + live price)  
- Order detail: driver name, truck plate, **live map**  
- Journey phases: Awaiting accept / On the way / Stopped / Delivered  
- Pay: SafePay hosted checkout (HMAC-verified) or Cash on Delivery  
- Notifications for assignment & status; cancelled orders hidden from dashboard  

---

## Slide 12 — Admin Experience
- Dashboard stats + **live WebSocket fleet map**  
- Orders: priority badge, assign, **reassign**, bulk assign, workload table  
- CRUD: trucks, drivers, customers, users, parcels, maintenance, incidents  
- Recovery requests/responses view  

---

## Slide 13 — Security
- bcrypt passwords · JWT Bearer on protected APIs  
- Role-based dependencies on every router  
- Customer sees only own orders · driver only own jobs/truck  
- Pydantic validation · secrets in `.env` via pydantic-settings  
- WebSockets reject invalid tokens (close 4401)  

- Payments: server-side amount, ownership checks, SafePay signature (HMAC-SHA256) + webhook (HMAC-SHA512) verification

**Known hardening TODOs:** set `AUTH_SECRET_KEY` (default fallback exists) · require token on WebSockets.

---

## Slide 14 — What Is Implemented vs Future
**Implemented**
- Full order system (create → price → assign → accept → GPS → deliver → pay)  
- Assignment hierarchy + admin reassign  
- **WebSockets + Redis Pub/Sub live tracking**  
- **10 km breakdown proximity alerts**  
- SafePay payments (signed redirect + webhook) + COD · notifications · maintenance  
- Alembic migrations · GPS simulator · integration tests  

**Future**
- AI recovery agent (pick rescue truck by distance + free capacity + route; `ai_reasoning` column ready)  
- Automated parcel transfer after recovery  
- Microservices + Nginx · unit tests  

---

## Slide 15 — Live Demo Checklist
1. Run simulator → Admin dashboard: truck moves live  
2. Login Admin / Customer / Driver  
3. Customer create order (High priority, price shown)  
4. Admin: auto-assign + workload  
5. Driver Accept → START (location permission)  
6. Customer map: On the way → Driver PAUSE → Stopped  
7. Driver reports breakdown → nearby driver alert  
8. Deliver → customer pays → notification  

**Credentials**
| Admin | Customer | Driver |
|-------|----------|--------|
| admin@test.com / admin123 | customer@test.com / customer123 | driver@test.com / driver123 |

---

## Slide 16 — Conclusion
- Role-based logistics platform with working **order + live GPS** loop  
- Real-time push via **Redis Pub/Sub → WebSockets**, polling fallback  
- Smart **least-loaded assignment** with admin override  
- **10 km breakdown alerts** as the foundation for vehicle recovery  
- Honest boundary: AI recovery agent is next  

**Closing line:**  
*"Customers book, drivers move, the system assigns, the map updates live — and when a truck breaks down, help nearby is alerted instantly."*

---

## Examiner Q&A prep (top 6)
1. **Location tech?** Browser Geolocation → REST ingest → Postgres + Redis → Pub/Sub → WebSocket → Leaflet.  
2. **Why Redis if you have Postgres?** Fast latest-position cache and Pub/Sub broadcast; Postgres stays source of truth.  
3. **What if Redis is down?** All Redis calls are try/except; UI falls back to REST polling.  
4. **Assignment?** Admin manual > auto (available, has truck, least-loaded, lowest ID).  
5. **Nearby trucks?** Haversine great-circle distance, 10 km radius, excludes breakdown/maintenance/off-duty.  
6. **AI?** Data model ready (`recovery_requests.ai_reasoning`); agent itself **not implemented** yet.
