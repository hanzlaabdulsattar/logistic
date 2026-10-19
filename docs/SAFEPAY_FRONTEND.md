# SafePay Integration

## Modes
| Mode | When | Checkout |
|------|------|----------|
| **Live** (sandbox or production) | `SAFEPAY_PUBLIC_KEY` (non-demo) **and** `SAFEPAY_SECRET_KEY` set | SafePay hosted checkout |
| **Demo** | keys missing / demo key | Local page `/customer/payments/checkout` (no real charge) |

## Backend `.env`
```
SAFEPAY_ENV=sandbox                 # or production
SAFEPAY_PUBLIC_KEY=sec_...          # merchant API key ("client")
SAFEPAY_SECRET_KEY=...              # verifies redirect signature
SAFEPAY_WEBHOOK_SECRET=...          # verifies webhooks
API_BASE_URL=http://127.0.0.1:8000  # SafePay sends the browser back here
FRONTEND_BASE_URL=http://127.0.0.1:5173
```
In the SafePay dashboard, register the webhook URL `{API_BASE_URL}/payments/safepay/webhook`.
SafePay must be able to reach it, so use a public URL or a tunnel such as ngrok.

## Live flow
```
1. POST /payments/safe-pay {order_id}
     server: amount = order.amount (server pricing, client amount ignored)
     server → SafePay POST /order/v1/init {amount, client, currency, environment} → tracker
     payment.provider_payment_id = tracker
     ← checkout_url = .../checkout/pay?beacon=<tracker>&redirect_url=…&cancel_url=…
2. Browser → SafePay hosted checkout
3. SafePay → POST {API}/payments/safepay/return?payment_id=…  (body: tracker, sig, reference)
     verify: tracker == payment.provider_payment_id
             sig == HMAC-SHA256(SAFEPAY_SECRET_KEY, tracker)
     ok → status=paid, else failed
     303 → {frontend}/customer/payments/result?payment_id=…&status=…
4. SafePay webhook → POST /payments/safepay/webhook
     verify: X-SFPY-SIGNATURE == HMAC-SHA512(SAFEPAY_WEBHOOK_SECRET, JSON(body.data))
     type "payment:created" → paid (backup if the browser never returns)
5. Result page reads GET /payments/{id}, polling briefly while pending
```
Cancel at SafePay leads to `/payments/safepay/cancel`, which redirects to the result page. The payment stays pending, so the customer can retry or switch to COD.

## Rules enforced by the server
- Customers can only see or pay **their own** orders (admin can see all).
- The amount always comes from the order's server-side pricing.
- An order that is already paid returns **409** for a new SafePay or COD request.
- `POST /payments/{id}/mark-paid`: an admin can set any status. A customer can only finish their own payment in **demo mode**; live payments are confirmed by SafePay only.
- Choosing COD cancels any open SafePay checkout for that order.
- COD is marked **paid automatically** when the driver sets the order to delivered.
- Redirects only go to trusted frontend origins (CORS list, localhost, or `FRONTEND_BASE_URL`).

## Endpoints
| Method | Path | Auth |
|--------|------|------|
| POST | `/payments/safe-pay` | JWT (order owner / admin) |
| POST | `/payments/cod` | JWT (order owner / admin) |
| GET | `/payments/{id}` | JWT (owner / admin) |
| POST | `/payments/{id}/mark-paid` | JWT (admin, or owner in demo mode) |
| GET | `/orders/{order_id}/payment`, `/payments/order/{order_id}` | JWT (owner / admin) |
| GET/POST | `/payments/safepay/return` | HMAC signature |
| GET/POST | `/payments/safepay/cancel` | none (no state change) |
| POST | `/payments/safepay/webhook` | `X-SFPY-SIGNATURE` |

## Tests
`pytest tests/integration/test_payments.py` covers demo checkout, ownership, server-side amount, live redirect (forged and genuine signature), the open-redirect guard, webhook verification, and COD settlement.
