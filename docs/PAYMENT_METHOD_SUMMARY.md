# Payment Method — Implementation Summary

## 1. Overview

The logistics platform now has a **payment module** for:

| Method | What happens |
|--------|----------------|
| **SafePay** | Backend creates a SafePay tracker → customer pays on SafePay hosted checkout → server verifies the HMAC signature / webhook → paid (local demo checkout when no keys) |
| **Cash on Delivery (COD)** | Backend records payment intent → marked paid automatically when the driver delivers |

Amount comes from **order pricing** (PKR 20/km, weight min 3 kg, max distance 40 km).

---

## 2. Pricing → Payment link

```
Customer creates order
  → backend computes amount = distance_km × 20
  → stores amount / rate / distance / weight on order
  → payment module charges that order.amount
```

**Rules**
- Weight: **min 3 kg** (no max weight)
- Distance: **max 40 km** (over → “Distance limit exceeded”)
- Rate: **PKR 20 / km**

---

## 3. Database

**Table: `payments`**

| Column | Purpose |
|--------|---------|
| id | Payment PK |
| order_id | Linked order |
| customer_user_id | Customer user |
| amount / currency | What to charge (usually order.amount) |
| method | `safepay` \| `cod` \| `card` |
| provider | e.g. safepay, cash_on_delivery |
| provider_payment_id | SafePay / external ref |
| checkout_url | Hosted or sandbox checkout link |
| status | pending → paid / failed / cancelled |
| message / description | UX text |
| created_at / updated_at | Audit |

---

## 4. Backend code map

```
app/models/payment.py
  Payment, PaymentMethod, PaymentStatus

app/modules/payments/
  schemas.py   — request/response models
  service.py   — SafePay session, COD, mark paid, order summary
  router.py    — HTTP endpoints
  __init__.py

app/main.py
  include_router(payments_router)
  include_router(orders_payment_router)  # /orders/{id}/payment
```

### Env (`.env`)
```
SAFEPAY_ENV=sandbox
SAFEPAY_PUBLIC_KEY=sp_public_demo_key_replace_me
SAFEPAY_MERCHANT_CODE=DEMO_MERCHANT
FRONTEND_BASE_URL=http://127.0.0.1:5173
```

Secret merchant keys stay **server-side only**.

---

## 5. API endpoints (implemented & tested)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/payments/safe-pay` | Create SafePay payment session |
| POST | `/payments/cod` | Record Cash on Delivery |
| GET | `/payments/{id}` | Get payment status |
| POST | `/payments/{id}/mark-paid` | Admin any status; customer only in demo mode |
| GET/POST | `/payments/safepay/return` | SafePay redirect (signature verified) |
| POST | `/payments/safepay/webhook` | SafePay webhook (signature verified) |
| GET | `/orders/{order_id}/payment` | Order + latest payment summary |
| GET | `/payments/order/{order_id}` | Same summary (alt path) |

Customer/admin payment APIs require **JWT Bearer** auth and check order ownership. SafePay callbacks are authenticated by HMAC signatures. Full flow: `docs/SAFEPAY_FRONTEND.md`.

### SafePay create response
```json
{
  "payment_id": 3,
  "order_id": 14,
  "amount": 58.0,
  "currency": "PKR",
  "status": "pending",
  "checkout_url": "http://127.0.0.1:5173/customer/payments/checkout?payment_id=3&...",
  "provider": "safepay",
  "demo_mode": true
}
```

---

## 6. Frontend flow

### Customer → Pay
1. Open order → **Pay**
2. Choose **SafePay** or **Cash on Delivery**
3. Amount taken from **order.amount** (stored pricing)

### SafePay
```
POST /payments/safe-pay
  → checkout_url
  → browser goes to /customer/payments/checkout
  → user “pays”
  → POST /payments/{id}/mark-paid  (sandbox until official webhook)
  → /customer/payments/result
```

### COD
```
POST /payments/cod
  → payment method=cod, status=pending
  → “Pay driver on delivery”
```

### UI screens
| Route | Role |
|-------|------|
| `/customer/orders/:id/pay` | Method picker + amount + SafePay/COD |
| `/customer/payments/checkout` | SafePay-style sandbox checkout |
| `/customer/payments/result` | Paid / failed / COD result |
| `/customer/payments` | History list |
| My Orders | Amount column + Pay button |

---

## 7. End-to-end verification (this project)

```
Order #14 amount = 58 PKR (distance × 20)
POST /payments/safe-pay     → payment_id=3, checkout_url with payment_id=3
POST /payments/3/mark-paid  → status=paid, provider_payment_id=SP-TEST-1
GET  /orders/14/payment     → amount 58, payment paid
POST /payments/cod          → method=cod, pending
```

Frontend build: **✅ passing**

---

## 8. What is complete vs later

### Complete
- Payment model + APIs
- SafePay session + sandbox checkout URL
- COD recording
- Mark paid / get status / order payment summary
- Frontend method picker + history
- Pricing stored on order and used for charge amount

### Later (official SafePay)
- Real SafePay merchant API credentials
- Server-side signature verification
- Production webhook (IPN) instead of `mark-paid`
- Optional: update order status to “paid” after webhook

---

## 9. How to demo

```
Backend:  uvicorn app.main:app --port 8000
Frontend: npm run dev  →  http://127.0.0.1:5173

Login customer@test.com / customer123
Create order (weight ≥ 3 kg, distance ≤ 40 km)
Pay → SafePay or COD
Check /customer/payments
```

**Seed logins:** admin / customer / driver `@test.com` + passwords `admin123` / `customer123` / `driver123`

---

## 10. One-line summary

> **Payment method module:** orders store delivery amount (PKR 20/km); customers pay via **SafePay** (session + sandbox checkout) or **COD**; backend `payments` table tracks method, amount, and status end-to-end.
