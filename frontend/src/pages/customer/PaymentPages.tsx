import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { paymentsApi } from '../../api/payments'
import { userApi } from '../../api/endpoints'
import { extractError } from '../../api/client'
import {
  ErrorBanner,
  Field,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import { PricingBreakdownCard } from '../../components/PricingCard'
import type { Order } from '../../types'
import type { OrderPaymentSummary, Payment } from '../../types/payments'
import {
  calculateDeliveryPricing,
  formatMoney,
  type PricingBreakdown,
} from '../../utils/pricing'
import {
  SAFE_PAY_BRAND,
  SAFEPAY_ENV,
  SAFEPAY_MERCHANT_CODE,
} from '../../utils/safepayConfig'

export type PaymentMethod = 'safepay' | 'cod'

const METHOD_META: Record<
  PaymentMethod,
  { label: string; badge: string; description: string; enabled: boolean }
> = {
  safepay: {
    label: 'SafePay (Card / Wallet)',
    badge: 'Online',
    description: 'Pay online via SafePay hosted checkout.',
    enabled: true,
  },
  cod: {
    label: 'Cash on Delivery',
    badge: 'COD',
    description: 'Pay cash when the driver delivers your parcel.',
    enabled: true,
  },
}

const OPEN_STATUSES = ['pending', 'processing']
const RESULT_POLL_MS = 3000
const RESULT_POLL_MAX = 10

function orderPricing(order: Order): PricingBreakdown {
  return calculateDeliveryPricing({
    pickup_lat: order.pickup_lat,
    pickup_lng: order.pickup_lng,
    delivery_lat: order.delivery_lat,
    delivery_lng: order.delivery_lng,
    weight_kg: order.weight_kg ?? 0,
  })
}

function resolveAmount(order: Order, calc: PricingBreakdown): number {
  if (order.amount != null && order.amount > 0) return order.amount
  return calc.total_amount
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'warn',
    processing: 'info',
    paid: 'ok',
    failed: 'danger',
    cancelled: 'muted',
    refunded: 'info',
  }
  return map[status] || 'info'
}

function titleCaseStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function resultUrl(payment: Payment, status?: string): string {
  return (
    `/customer/payments/result?payment_id=${payment.id}&order_id=${payment.order_id}` +
    `&status=${status || payment.status}&method=${payment.method}`
  )
}

/* ===================== Payment method selection + checkout ===================== */

export function CustomerOrderPay() {
  const { id } = useParams()
  const orderId = Number(id)
  const [order, setOrder] = useState<Order | null>(null)
  const [summary, setSummary] = useState<OrderPaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('safepay')
  const [codNote, setCodNote] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [orderRes, paymentSummary] = await Promise.all([
        userApi.getOrder(orderId),
        paymentsApi.getOrderPayment(orderId),
      ])
      setOrder(orderRes.data)
      setSummary(paymentSummary)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const pricing = useMemo<PricingBreakdown | null>(() => {
    if (!order) return null
    const p = orderPricing(order)
    return {
      ...p,
      total_amount: summary?.amount || resolveAmount(order, p),
      currency: order.currency || p.currency,
      rate_per_km: order.rate_per_km ?? p.rate_per_km,
      distance_km: order.distance_km ?? p.distance_km,
      weight_kg: order.weight_kg ?? p.weight_kg,
      formula: order.pricing_formula || p.formula,
    }
  }, [order, summary])

  const amount = pricing?.total_amount ?? 0
  const currency = pricing?.currency || 'PKR'
  const current = summary?.payment ?? null
  const amountLocked = current?.status === 'paid' || summary?.can_pay === false

  async function payWithSafePay() {
    if (!order) return
    setBusy(true)
    setError(null)
    try {
      const session = await paymentsApi.createSafePayPayment({
        order_id: order.id,
        description: `Delivery order #${order.id} · ${order.pickup_address || 'pickup'} → ${order.delivery_address || 'delivery'}`,
      })
      window.location.href = session.checkout_url
    } catch (err) {
      setError(extractError(err))
      setBusy(false)
    }
  }

  async function payWithCod() {
    if (!order) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await paymentsApi.createCodPayment({
        order_id: order.id,
        note: codNote || undefined,
      })
      setSuccess(
        `Cash on Delivery saved for order #${order.id}. Pay ${formatMoney(result.amount, result.currency)} to the driver on delivery.`,
      )
      setSummary(await paymentsApi.getOrderPayment(order.id))
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading && !order) return <LoadingBlock label="Loading payment…" />
  if (!order) {
    return (
      <div className="page">
        <ErrorBanner message={error || 'Order not found'} />
        <Link className="btn btn-ghost" to="/customer/orders">
          Back to orders
        </Link>
      </div>
    )
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Payment method"
        subtitle={`Order #${order.id} · ${order.pickup_address || 'Pickup'} → ${order.delivery_address || 'Delivery'}`}
        actions={
          <>
            <Link className="btn btn-ghost" to={`/customer/orders/${order.id}`}>
              Back to order
            </Link>
            <Link className="btn btn-ghost" to="/customer/payments">
              Payments
            </Link>
          </>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="safepay-hero">
        <div className="safepay-logo">Pay</div>
        <div>
          <strong>Choose payment method</strong>
          <div className="muted small">
            Amount from order pricing · SafePay env {SAFEPAY_ENV} · Merchant{' '}
            {SAFEPAY_MERCHANT_CODE}
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Order summary</h3>
        <div className="detail-grid">
          <div>
            <span className="field-label">Order</span>
            <div>#{order.id}</div>
          </div>
          <div>
            <span className="field-label">Order status</span>
            <div>
              <StatusBadge value={order.status} />
            </div>
          </div>
          <div>
            <span className="field-label">Driver</span>
            <div>{order.driver_name || 'Not assigned yet'}</div>
          </div>
          <div>
            <span className="field-label">Weight / distance</span>
            <div>
              {order.weight_kg ?? pricing?.weight_kg ?? '—'} kg ·{' '}
              {order.distance_km ?? pricing?.distance_km ?? '—'} km
            </div>
          </div>
          <div>
            <span className="field-label">Rate</span>
            <div>{formatMoney(pricing?.rate_per_km ?? 20, 'PKR')} / km</div>
          </div>
          <div>
            <span className="field-label">Amount payable</span>
            <div>
              <strong>{formatMoney(amount, currency)}</strong>
            </div>
          </div>
          {current ? (
            <div>
              <span className="field-label">Current payment</span>
              <div>
                <span className={`badge ${statusBadge(current.status)}`}>
                  {titleCaseStatus(current.status)}
                </span>{' '}
                <span className="muted small">
                  {current.method === 'cod' ? 'Cash on Delivery' : 'SafePay'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {pricing ? (
          <div className="mt">
            <PricingBreakdownCard pricing={pricing} title="Delivery charge" />
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Payment methods</h2>
          {current?.status === 'paid' ? <span className="badge ok">Paid</span> : null}
        </div>

        <div className="safepay-methods">
          {(Object.keys(METHOD_META) as PaymentMethod[]).map((key) => {
            const meta = METHOD_META[key]
            const selected = method === key
            return (
              <label
                key={key}
                className={`safepay-method${selected ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="paymethod"
                  checked={selected}
                  disabled={amountLocked || busy}
                  onChange={() => setMethod(key)}
                />
                <div className="method-body">
                  <div className="method-head">
                    <strong>{meta.label}</strong>
                    <span className={`badge ${key === 'safepay' ? 'info' : 'warn'}`}>
                      {meta.badge}
                    </span>
                  </div>
                  <div className="muted small">{meta.description}</div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="stack mt">
          {method === 'safepay' ? (
            <>
              <div className="safepay-hero">
                <div className="safepay-logo">SafePay</div>
                <div>
                  <div className="muted small">{SAFE_PAY_BRAND.tagline}</div>
                  <div className="chip-row">
                    <span className="badge info">{SAFE_PAY_BRAND.envLabel}</span>
                    <span className="badge muted">PKR · {SAFEPAY_MERCHANT_CODE}</span>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary full"
                disabled={busy || amountLocked}
                onClick={() => void payWithSafePay()}
              >
                {busy
                  ? 'Redirecting to SafePay…'
                  : `Pay ${formatMoney(amount, currency)} with SafePay`}
              </button>
              <p className="muted small">{SAFE_PAY_BRAND.docsHint}</p>
            </>
          ) : (
            <>
              <Field
                label="Note for COD (optional)"
                hint="Tell the driver anything about cash payment"
              >
                <textarea
                  rows={3}
                  value={codNote}
                  onChange={(e) => setCodNote(e.target.value)}
                  placeholder="e.g. Please collect exact change"
                />
              </Field>
              <button
                className="btn btn-warn full"
                disabled={busy || amountLocked}
                onClick={() => void payWithCod()}
              >
                {busy
                  ? 'Saving…'
                  : `Confirm Cash on Delivery · ${formatMoney(amount, currency)}`}
              </button>
              <p className="muted small">
                The payment is marked paid automatically when the driver delivers your order.
              </p>
            </>
          )}

          <div className="status-actions">
            <Link className="btn btn-ghost" to="/customer/payments">
              View payment history
            </Link>
            <Link className="btn btn-ghost" to={`/customer/orders/${order.id}`}>
              Track order
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===================== Demo checkout (used only when SafePay keys are not configured) ===================== */

export function SafePayCheckoutPage() {
  const [params] = useSearchParams()
  const paymentId = Number(params.get('payment_id') || 0)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      if (!paymentId) {
        setError('Missing payment id — start the payment from your order.')
        setLoading(false)
        return
      }
      try {
        setPayment(await paymentsApi.getPayment(paymentId))
      } catch (err) {
        setError(extractError(err))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [paymentId])

  async function complete(next: 'paid' | 'cancelled') {
    if (!payment) return
    setBusy(true)
    setError(null)
    try {
      const updated = await paymentsApi.markPaid(payment.id, {
        status: next,
        message:
          next === 'paid'
            ? 'Sandbox SafePay authorization succeeded'
            : 'Customer cancelled checkout',
      })
      setStatus(updated.status)
      window.setTimeout(() => {
        window.location.href = resultUrl(updated)
      }, 600)
    } catch (err) {
      setError(extractError(err))
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading checkout…" />

  const open = payment ? OPEN_STATUSES.includes(payment.status) : false
  const amountLabel = payment ? formatMoney(payment.amount, payment.currency) : '—'

  return (
    <div className="auth-page">
      <div className="auth-card safepay-checkout-card">
        <div className="auth-brand">
          <span className="safepay-logo">SafePay</span>
          <div>
            <h1>Secure checkout</h1>
            <p>
              {SAFE_PAY_BRAND.envLabel} · {SAFEPAY_MERCHANT_CODE} · {SAFEPAY_ENV}
            </p>
          </div>
        </div>

        <div className="poll-banner">
          <span className="badge warn">Demo checkout</span>
          <span>
            SafePay keys are not configured on the server, so this local page simulates the
            hosted checkout. No real card is charged.
          </span>
        </div>

        {status ? <SuccessBanner message={`Payment ${status} — redirecting…`} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {payment ? (
          <div className="stack">
            <div className="detail-grid">
              <div>
                <span className="field-label">Payment ID</span>
                <div>{payment.id}</div>
              </div>
              <div>
                <span className="field-label">Order</span>
                <div>#{payment.order_id}</div>
              </div>
              <div>
                <span className="field-label">Amount</span>
                <div>
                  <strong>{amountLabel}</strong>
                </div>
              </div>
              <div>
                <span className="field-label">Status</span>
                <div>
                  <span className={`badge ${statusBadge(payment.status)}`}>
                    {titleCaseStatus(payment.status)}
                  </span>
                </div>
              </div>
            </div>

            {open ? (
              <>
                <Field label="Card number">
                  <input inputMode="numeric" defaultValue="4242 4242 4242 4242" />
                </Field>
                <div className="location-row">
                  <Field label="Expiry">
                    <input defaultValue="12/28" />
                  </Field>
                  <Field label="CVC">
                    <input defaultValue="123" />
                  </Field>
                </div>
                <Field label="Cardholder name">
                  <input defaultValue="Test Customer" />
                </Field>

                <button
                  className="btn btn-primary full"
                  disabled={busy}
                  onClick={() => void complete('paid')}
                >
                  {busy ? 'Authorizing…' : `Pay ${amountLabel}`}
                </button>
                <button
                  className="btn btn-ghost full"
                  disabled={busy}
                  onClick={() => void complete('cancelled')}
                >
                  Cancel payment
                </button>
              </>
            ) : (
              <Link className="btn btn-primary full" to={resultUrl(payment)}>
                View payment result
              </Link>
            )}
          </div>
        ) : (
          <Link className="btn btn-ghost full" to="/customer/payments">
            Back to payments
          </Link>
        )}
      </div>
    </div>
  )
}

/* ===================== Payment result ===================== */

export function CustomerPaymentResult() {
  const [params] = useSearchParams()
  const orderId = Number(params.get('order_id') || 0)
  const paymentId = Number(params.get('payment_id') || 0)
  const checkoutCancelled = params.get('status') === 'cancelled'
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    let timer: number | undefined

    async function fetchPayment(): Promise<Payment | null> {
      if (paymentId) return paymentsApi.getPayment(paymentId)
      if (orderId) return (await paymentsApi.getOrderPayment(orderId)).payment ?? null
      return null
    }

    async function run() {
      try {
        const p = await fetchPayment()
        if (cancelled) return
        setPayment(p)
        setError(null)
        // SafePay may confirm via webhook a moment after the redirect — keep checking
        const waiting =
          p && p.method === 'safepay' && OPEN_STATUSES.includes(p.status) && !checkoutCancelled
        if (waiting && attempts < RESULT_POLL_MAX) {
          attempts += 1
          timer = window.setTimeout(() => void run(), RESULT_POLL_MS)
        }
      } catch (err) {
        if (!cancelled) setError(extractError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [paymentId, orderId, checkoutCancelled])

  const rawStatus = payment?.status || 'pending'
  // Cancelled at SafePay: payment stays open server-side so it can be retried
  const status = checkoutCancelled && OPEN_STATUSES.includes(rawStatus) ? 'cancelled' : rawStatus
  const method = payment?.method || 'safepay'
  const resolvedOrderId = payment?.order_id || orderId || null

  return (
    <div className="page narrow">
      <PageHeader
        title="Payment result"
        subtitle="Transaction status"
        actions={
          <>
            <Link className="btn btn-ghost" to="/customer/payments">
              Payments
            </Link>
            {resolvedOrderId ? (
              <Link className="btn btn-primary" to={`/customer/orders/${resolvedOrderId}`}>
                View order #{resolvedOrderId}
              </Link>
            ) : (
              <Link className="btn btn-primary" to="/customer/orders">
                My orders
              </Link>
            )}
          </>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <LoadingBlock label="Checking payment…" />
      ) : !payment ? (
        <div className="panel">
          <p className="muted">No payment found for this order yet.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="status-badge-row">
            <span className={`badge ${statusBadge(status)}`}>{titleCaseStatus(status)}</span>
            <span className={`badge ${method === 'cod' ? 'warn' : 'info'}`}>
              {method === 'cod' ? 'Cash on Delivery' : 'SafePay'}
            </span>
          </div>
          <div className="detail-grid mt">
            <div>
              <span className="field-label">Payment ID</span>
              <div>{payment.id}</div>
            </div>
            <div>
              <span className="field-label">Order</span>
              <div>#{payment.order_id}</div>
            </div>
            <div>
              <span className="field-label">Amount</span>
              <div>{formatMoney(payment.amount, payment.currency)}</div>
            </div>
            <div>
              <span className="field-label">Provider</span>
              <div>{method === 'cod' ? 'Cash on delivery' : `SafePay · ${SAFEPAY_ENV}`}</div>
            </div>
          </div>
          {payment.message ? <p className="muted small mt">{payment.message}</p> : null}
          {status === 'pending' && method === 'safepay' ? (
            <p className="muted small">Waiting for SafePay to confirm the payment…</p>
          ) : null}
          {['cancelled', 'failed'].includes(status) ? (
            <Link className="btn btn-primary mt" to={`/customer/orders/${payment.order_id}/pay`}>
              Try again
            </Link>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ===================== Payments list ===================== */

export function CustomerPayments() {
  const [orders, setOrders] = useState<Order[]>([])
  const [summaries, setSummaries] = useState<Record<number, OrderPaymentSummary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await userApi.listOrders()
        setOrders(res.data)
        const entries = await Promise.all(
          res.data.slice(0, 30).map(async (o) => {
            try {
              return [o.id, await paymentsApi.getOrderPayment(o.id)] as const
            } catch {
              return null
            }
          }),
        )
        const map: Record<number, OrderPaymentSummary> = {}
        for (const entry of entries) {
          if (entry) map[entry[0]] = entry[1]
        }
        setSummaries(map)
      } catch (err) {
        setError(extractError(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const rows = useMemo(() => {
    return orders
      .map((o) => {
        const summary = summaries[o.id]
        const p = orderPricing(o)
        return {
          order: o,
          amount: summary?.amount || resolveAmount(o, p),
          currency: summary?.currency || o.currency || p.currency,
          payment: summary?.payment ?? null,
          canPay: summary ? summary.can_pay : o.status !== 'cancelled',
        }
      })
      .filter((r) => r.payment || r.canPay)
      .sort((a, b) => (a.order.created_at < b.order.created_at ? 1 : -1))
  }, [orders, summaries])

  return (
    <div className="page">
      <PageHeader
        title="Payments"
        subtitle="SafePay & Cash on Delivery for your orders"
        actions={
          <Link className="btn btn-primary" to="/customer/orders">
            My orders
          </Link>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}

      <div className="safepay-hero">
        <div className="safepay-logo">Pay</div>
        <div>
          <strong>Payment methods</strong>
          <div className="muted small">
            SafePay (online) · Cash on Delivery · amount from order pricing (PKR 20/km)
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <h3>No payments yet</h3>
            <p>Create an order, then choose SafePay or Cash on Delivery.</p>
            <Link className="btn btn-primary" to="/customer/orders/new">
              Create order
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Weight / dist</th>
                  <th>Method</th>
                  <th>Payment status</th>
                  <th>Order status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ order: o, amount, currency, payment, canPay }) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/customer/orders/${o.id}`}>#{o.id}</Link>
                    </td>
                    <td>
                      <strong>{formatMoney(amount, currency)}</strong>
                    </td>
                    <td>
                      {o.weight_kg ?? '—'} kg · {o.distance_km ?? '—'} km
                    </td>
                    <td>
                      {payment?.method === 'cod' ? (
                        <span className="badge warn">COD</span>
                      ) : payment ? (
                        <span className="badge info">SafePay</span>
                      ) : (
                        <span className="badge muted">—</span>
                      )}
                    </td>
                    <td>
                      {payment ? (
                        <span className={`badge ${statusBadge(payment.status)}`}>
                          {titleCaseStatus(payment.status)}
                        </span>
                      ) : (
                        <span className="badge warn">Not paid</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge value={o.status} />
                    </td>
                    <td className="actions">
                      {canPay ? (
                        <Link className="btn btn-sm btn-primary" to={`/customer/orders/${o.id}/pay`}>
                          Pay
                        </Link>
                      ) : null}
                      {payment ? (
                        <Link className="btn btn-sm" to={resultUrl(payment)}>
                          Details
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
