import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { userApi } from '../../api/endpoints'
import { extractError } from '../../api/client'
import {
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import type { CustomerProfile, Notification, Order, Parcel } from '../../types'
import { formatDate, formatCoord, titleCase } from '../../utils/format'
import { useGeolocation } from '../../utils/useGeolocation'
import { POLL_INTERVALS, usePolling } from '../../utils/usePolling'
import { DriverTrackingMap } from '../../components/DriverTrackingMap'
import { journeyLabel } from '../../components/journeyLabel'
import { PricingBreakdownCard, RateConfigHint } from '../../components/PricingCard'
import {
  MAX_DISTANCE_KM,
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
  calculateDeliveryPricing,
  formatMoney,
  parseWeightKg,
  validateWeight,
  type PricingBreakdown,
} from '../../utils/pricing'

export function CustomerDashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const [p, o, n] = await Promise.all([
        userApi.profile(),
        userApi.listOrders(),
        userApi.listNotifications({ unread_only: true }),
      ])
      setProfile(p.data)
      setOrders(o.data)
      setNotifications(n.data)
      setLastUpdated(new Date())
      setError(null)
      if (o.data.length) {
        const pr = await userApi.listParcels()
        setParcels(pr.data)
      }
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // REST polling — order/parcel updates without WebSocket channels
  usePolling(() => void load({ silent: true }), POLL_INTERVALS.customerFeedMs)

  if (loading && !profile) return <LoadingBlock label="Loading customer dashboard…" />

  // Cancelled orders must not appear on the customer dashboard
  const visibleOrders = orders.filter((o) => o.status !== 'cancelled')
  const cancelledOrderIds = new Set(
    orders.filter((o) => o.status === 'cancelled').map((o) => o.id),
  )
  const isCancelledOrderNotification = (n: Notification) => {
    const text = `${n.title} ${n.message}`
    for (const id of cancelledOrderIds) {
      if (text.includes(`Order #${id}`) || text.includes(`order #${id}`)) return true
    }
    return n.title.toLowerCase().includes('cancelled')
  }
  // Dashboard unread alerts only — never show cancelled-order notifications
  const dashboardNotifications = notifications.filter(
    (n) => !n.is_read && !isCancelledOrderNotification(n),
  )
  const active = visibleOrders.filter((o) => o.status !== 'delivered')
  const assigned = visibleOrders.filter((o) => o.driver_id != null)
  const latestAssigned = assigned[0]
  const cancelledCount = cancelledOrderIds.size
  const recentOrders = visibleOrders.slice(0, 8)

  return (
    <div className="page">
      <PageHeader
        title="Customer Dashboard"
        subtitle="Track orders, parcels, and delivery updates"
        actions={
          <>
            <Link className="btn btn-ghost" to="/customer/notifications">
              Notifications ({dashboardNotifications.length})
            </Link>
            <Link className="btn btn-primary" to="/customer/orders/new">
              + Create order
            </Link>
          </>
        }
      />

      <div className="poll-banner">
        <span className="badge info">REST poll</span>
        <span>
          Orders & notifications refresh every {POLL_INTERVALS.customerFeedMs / 1000}s
          {lastUpdated ? ` · last update ${lastUpdated.toLocaleTimeString()}` : ''} ·
          /ws/customer/{'{id}'} not wired yet
        </span>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="stat-grid">
        <StatCard label="Total orders" value={orders.length} />
        <StatCard label="Active orders" value={active.length} tone="info" />
        <StatCard
          label="In transit"
          value={visibleOrders.filter((o) => o.status === 'in_transit').length}
          tone="info"
        />
        <StatCard
          label="Delivered"
          value={visibleOrders.filter((o) => o.status === 'delivered').length}
          tone="ok"
        />
        <StatCard label="Assigned drivers" value={assigned.length} tone="ok" />
        <button
          type="button"
          className="stat-card tone-info clickable"
          onClick={() => navigate('/customer/parcels')}
          title="Open My Parcels"
        >
          <div className="stat-label">Parcels</div>
          <div className="stat-value">{parcels.length}</div>
          <div className="stat-hint">
            {parcels.length === 0
              ? 'Created with each order — open list'
              : 'Open parcel tracking'}
          </div>
        </button>
        <StatCard
          label="Unread alerts"
          value={dashboardNotifications.length}
          tone="warn"
          hint="Cancelled-order alerts hidden"
        />
      </div>

      <div className="poll-banner">
        <span className="badge info">Parcels</span>
        <span>
          Each new order gets a parcel automatically (weight can be updated later by
          operations). Open <Link to="/customer/parcels">My Parcels</Link> or the order
          detail page to see status: pending → loaded → in transit → delivered.
        </span>
      </div>

      {cancelledCount > 0 ? (
        <div className="poll-banner">
          <span className="badge muted">Cancelled hidden</span>
          <span>
            {cancelledCount} cancelled order(s) and their notifications are excluded from this
            dashboard. Use <Link to="/customer/orders">My Orders</Link> → filter{' '}
            <em>cancelled</em> to review history.
          </span>
        </div>
      ) : null}

      {latestAssigned ? (
        <div className="driver-assigned-card">
          <div>
            <div className="field-label">Driver assigned to order #{latestAssigned.id}</div>
            <h3 style={{ margin: '4px 0' }}>
              {latestAssigned.driver_name || `Driver #${latestAssigned.driver_id}`}
            </h3>
            <div className="muted">
              {latestAssigned.driver_license ? `License ${latestAssigned.driver_license}` : ''}
              {latestAssigned.driver_phone ? ` · ${latestAssigned.driver_phone}` : ''}
              {latestAssigned.truck_plate
                ? ` · Truck ${latestAssigned.truck_plate}${latestAssigned.truck_model ? ` (${latestAssigned.truck_model})` : ''}`
                : ''}
            </div>
          </div>
          <div className="status-actions">
            <Link className="btn btn-primary" to={`/customer/orders/${latestAssigned.id}`}>
              Track order
            </Link>
            <Link className="btn btn-ghost" to="/customer/notifications">
              Assignment notifications
            </Link>
          </div>
        </div>
      ) : (
        <div className="poll-banner">
          <span className="badge warn">No driver yet</span>
          <span>
            When operations assign a driver, their name, license, and truck will appear here
            and in your notifications.
          </span>
        </div>
      )}

      <div className="two-col">
        <section className="panel">
          <div className="panel-header">
            <h2>Recent orders</h2>
            <Link to="/customer/orders">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState
              title="No active orders"
              description="Cancelled orders are hidden here. Create a new order to start tracking."
              action={
                <Link className="btn btn-primary" to="/customer/orders/new">
                  Create order
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Assigned driver</th>
                    <th>Pickup</th>
                    <th>Delivery</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/customer/orders/${o.id}`}>#{o.id}</Link>
                      </td>
                      <td>
                        <StatusBadge value={o.status} />
                      </td>
                      <td>
                        {o.driver_id != null ? (
                          <div>
                            <strong>{o.driver_name || `Driver #${o.driver_id}`}</strong>
                            <div className="muted small">
                              {o.truck_plate ? `Truck ${o.truck_plate}` : o.driver_license || ''}
                            </div>
                          </div>
                        ) : (
                          <span className="muted">Not assigned</span>
                        )}
                      </td>
                      <td>{o.pickup_address || formatCoord(o.pickup_lat, o.pickup_lng)}</td>
                      <td>{o.delivery_address || formatCoord(o.delivery_lat, o.delivery_lng)}</td>
                      <td>{formatDate(o.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Delivery notifications</h2>
            <Link to="/customer/notifications">Open inbox</Link>
          </div>
          {dashboardNotifications.length === 0 ? (
            <p className="muted">
              No new notifications. Cancelled-order alerts are hidden from the dashboard.
            </p>
          ) : (
            <ul className="notification-list">
              {dashboardNotifications.map((n) => (
                <li key={n.id} className={n.is_read ? 'read' : 'unread'}>
                  <div>
                    <strong>{n.title}</strong>
                    <div>{n.message}</div>
                    <div className="muted small">
                      {titleCase(n.type)} · {formatDate(n.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export function CustomerOrders() {
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await userApi.listOrders(statusFilter ? { status: statusFilter } : undefined)
      setItems(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  async function cancel(order: Order) {
    if (!window.confirm(`Cancel order #${order.id}?`)) return
    setError(null)
    setSuccess(null)
    try {
      await userApi.cancelOrder(order.id)
      setSuccess(`Order #${order.id} cancelled — hidden from dashboard and default list`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  // Hide cancelled unless user explicitly selects cancelled history filter
  const showCancelled = statusFilter === 'cancelled'
  const displayed = showCancelled
    ? items
    : items.filter((o) => o.status !== 'cancelled')
  const hiddenCancelled = items.filter((o) => o.status === 'cancelled').length

  return (
    <div className="page">
      <PageHeader
        title="My Orders"
        subtitle="Active deliveries — cancelled orders are hidden unless you filter for them"
        actions={
          <Link className="btn btn-primary" to="/customer/orders/new">
            + Create order
          </Link>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All (exclude cancelled)</option>
            {['pending', 'assigned', 'in_transit', 'delivered', 'reassigned'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="cancelled">cancelled (history only)</option>
          </select>
        </label>
      </div>

      {!showCancelled && hiddenCancelled > 0 ? (
        <div className="poll-banner">
          <span className="badge muted">Cancelled hidden</span>
          <span>
            {hiddenCancelled} cancelled order(s) not shown. Select status{' '}
            <em>cancelled</em> to view history.
          </span>
        </div>
      ) : null}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Assigned driver</th>
                  <th>Pickup</th>
                  <th>Delivery</th>
                  <th>Deadline</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/customer/orders/${o.id}`}>#{o.id}</Link>
                    </td>
                    <td>
                      <StatusBadge value={o.status} />
                    </td>
                    <td>
                      <strong>
                        {formatMoney(
                          o.amount ??
                            calculateDeliveryPricing({
                              pickup_lat: o.pickup_lat,
                              pickup_lng: o.pickup_lng,
                              delivery_lat: o.delivery_lat,
                              delivery_lng: o.delivery_lng,
                              weight_kg: o.weight_kg ?? 0,
                            }).total_amount,
                          o.currency || 'PKR',
                        )}
                      </strong>
                    </td>
                    <td>
                      {o.driver_id != null ? (
                        <div>
                          <strong>{o.driver_name || `Driver #${o.driver_id}`}</strong>
                          <div className="muted small">
                            {o.driver_license ? `${o.driver_license}` : ''}
                            {o.truck_plate ? ` · ${o.truck_plate}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="muted">Not assigned</span>
                      )}
                    </td>
                    <td>{o.pickup_address || formatCoord(o.pickup_lat, o.pickup_lng)}</td>
                    <td>{o.delivery_address || formatCoord(o.delivery_lat, o.delivery_lng)}</td>
                    <td>{formatDate(o.deadline)}</td>
                    <td>{formatDate(o.created_at)}</td>
                    <td className="actions">
                      <Link className="btn btn-sm" to={`/customer/orders/${o.id}`}>
                        Track
                      </Link>
                      {o.status !== 'cancelled' && o.status !== 'delivered' ? (
                        <Link className="btn btn-sm btn-primary" to={`/customer/orders/${o.id}/pay`}>
                          Pay
                        </Link>
                      ) : null}
                      {(o.status === 'pending' || o.status === 'assigned') && (
                        <button className="btn btn-sm danger" onClick={() => cancel(o)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayed.length === 0 ? (
              <p className="muted" style={{ padding: 12 }}>
                No orders to show for this filter.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export function CustomerCreateOrder() {
  const [form, setForm] = useState({
    pickup_address: '',
    delivery_address: '',
    pickup_lat: '',
    pickup_lng: '',
    delivery_lat: '',
    delivery_lng: '',
    deadline: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    weight_kg: '5',
    fragile: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<number | null>(null)
  const [lastPricing, setLastPricing] = useState<PricingBreakdown | null>(null)
  const geo = useGeolocation()

  const weightError = validateWeight(parseWeightKg(form.weight_kg))
  const pricing: PricingBreakdown | null = (() => {
    const pl = Number(form.pickup_lat)
    const plng = Number(form.pickup_lng)
    const dl = Number(form.delivery_lat)
    const dlng = Number(form.delivery_lng)
    if (![pl, plng, dl, dlng].every((n) => Number.isFinite(n))) return null
    return calculateDeliveryPricing({
      pickup_lat: pl,
      pickup_lng: plng,
      delivery_lat: dl,
      delivery_lng: dlng,
      weight_kg: parseWeightKg(form.weight_kg),
    })
  })()
  const distanceExceeded = !!pricing?.distance_valid === false || !!pricing?.limit_exceeded

  function set<K extends keyof typeof form>(key: K, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function useMyLocation(which: 'pickup' | 'delivery') {
    try {
      const loc = await geo.request()
      set(which === 'pickup' ? 'pickup_lat' : 'delivery_lat', String(loc.lat))
      set(which === 'pickup' ? 'pickup_lng' : 'delivery_lng', String(loc.lng))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location failed')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const weight = parseWeightKg(form.weight_kg)
    const wErr = validateWeight(weight)
    if (wErr) {
      setError(wErr)
      return
    }
    const pricingData = calculateDeliveryPricing({
      pickup_lat: Number(form.pickup_lat),
      pickup_lng: Number(form.pickup_lng),
      delivery_lat: Number(form.delivery_lat),
      delivery_lng: Number(form.delivery_lng),
      weight_kg: weight,
    })
    if (!pricingData.distance_valid || pricingData.limit_exceeded) {
      setError(
        pricingData.distance_error ||
          `Distance limit exceeded — max delivery distance is ${MAX_DISTANCE_KM} km`,
      )
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await userApi.createOrder({
        pickup_lat: Number(form.pickup_lat),
        pickup_lng: Number(form.pickup_lng),
        delivery_lat: Number(form.delivery_lat),
        delivery_lng: Number(form.delivery_lng),
        pickup_address: form.pickup_address || null,
        delivery_address: form.delivery_address || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        priority: form.priority,
        weight_kg: weight,
        fragile: form.fragile,
        amount: pricingData.total_amount,
        currency: pricingData.currency,
        distance_km: pricingData.distance_km,
        rate_per_km: pricingData.rate_per_km,
        rate_per_kg: 0,
        base_fee: 0,
        handling_fee: 0,
        pricing_formula: pricingData.formula,
      })
      const orderId = res.data.id
      setLastPricing(pricingData)
      setSuccess(
        `Order #${orderId} created (${form.priority}) · ${formatMoney(pricingData.total_amount, pricingData.currency)} · ${pricingData.distance_km} km × PKR 20/km`,
      )
      setForm({
        pickup_address: '',
        delivery_address: '',
        pickup_lat: '',
        pickup_lng: '',
        delivery_lat: '',
        delivery_lng: '',
        deadline: '',
        priority: 'normal',
        weight_kg: '5',
        fragile: false,
      })
      setLastCreatedOrderId(orderId)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Create Order"
        subtitle="Book a new delivery shipment — you will get a confirmation notification"
        actions={
          lastCreatedOrderId ? (
            <>
              <Link className="btn btn-ghost" to="/customer/notifications">
                Open notifications
              </Link>
              <Link className="btn btn-primary" to={`/customer/orders/${lastCreatedOrderId}`}>
                Track order #{lastCreatedOrderId}
              </Link>
            </>
          ) : (
            <Link className="btn btn-ghost" to="/customer/orders">
              My orders
            </Link>
          )
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      <RateConfigHint />
      {success ? (
        <div className="order-created-card">
          <div className="success-banner">{success}</div>
          {lastPricing ? (
            <PricingBreakdownCard pricing={lastPricing} title="Amount charged for this order" />
          ) : null}
          <p className="muted small">
            Notification title: <strong>Order #{lastCreatedOrderId} created</strong>
            <br />
            Message: “Your order has been created successfully. … Status: pending.”
          </p>
          <div className="status-actions">
            <Link className="btn btn-primary" to="/customer/notifications">
              View notification
            </Link>
            <Link className="btn btn-ghost" to={`/customer/orders/${lastCreatedOrderId}`}>
              Track order
            </Link>
            <Link
              className="btn btn-warn"
              to={`/customer/orders/${lastCreatedOrderId}/pay`}
            >
              Pay {lastPricing ? formatMoney(lastPricing.total_amount, lastPricing.currency) : 'now'}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <form onSubmit={onSubmit} className="stack">
          <Field label="Pickup address">
            <input
              value={form.pickup_address}
              onChange={(e) => set('pickup_address', e.target.value)}
              placeholder="Warehouse / pickup point"
            />
          </Field>
          <div className="location-row">
            <Field label="Pickup latitude">
              <input
                type="number"
                step="any"
                value={form.pickup_lat}
                onChange={(e) => set('pickup_lat', e.target.value)}
                required
              />
            </Field>
            <Field label="Pickup longitude">
              <input
                type="number"
                step="any"
                value={form.pickup_lng}
                onChange={(e) => set('pickup_lng', e.target.value)}
                required
              />
            </Field>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => useMyLocation('pickup')}
          >
            Use my current location as pickup
          </button>

          <Field label="Delivery address">
            <input
              value={form.delivery_address}
              onChange={(e) => set('delivery_address', e.target.value)}
              placeholder="Delivery destination"
            />
          </Field>
          <div className="location-row">
            <Field label="Delivery latitude">
              <input
                type="number"
                step="any"
                value={form.delivery_lat}
                onChange={(e) => set('delivery_lat', e.target.value)}
                required
              />
            </Field>
            <Field label="Delivery longitude">
              <input
                type="number"
                step="any"
                value={form.delivery_lng}
                onChange={(e) => set('delivery_lng', e.target.value)}
                required
              />
            </Field>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => useMyLocation('delivery')}
          >
            Use my current location as delivery
          </button>

          <Field label="Expected delivery deadline">
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
            />
          </Field>

          <Field label="Priority" hint="For assignment order; price is distance-based only">
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as typeof form.priority,
                }))
              }
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>

          <div className="location-row">
            <Field
              label="Parcel weight (kg)"
              hint={`Min ${MIN_WEIGHT_KG} kg (no maximum)`}
            >
              <input
                type="number"
                min={MIN_WEIGHT_KG}
                step="0.5"
                value={form.weight_kg}
                onChange={(e) => set('weight_kg', e.target.value)}
                required
              />
            </Field>
            <Field label="Fragile parcel?">
              <select
                value={form.fragile ? 'yes' : 'no'}
                onChange={(e) => set('fragile', e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </div>
          {weightError ? <div className="error-banner">{weightError}</div> : null}

          {pricing ? (
            <PricingBreakdownCard pricing={pricing} title="Delivery charge" />
          ) : (
            <div className="poll-banner">
              <span className="badge muted">Pricing</span>
              <span>
                Enter pickup & delivery coordinates. Charge = distance × PKR {20}/km.
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={busy || !!weightError || distanceExceeded}
          >
            {busy
              ? 'Creating…'
              : distanceExceeded
                ? 'Distance limit exceeded'
                : weightError
                  ? weightError
                  : pricing
                    ? `Create order · ${formatMoney(pricing.total_amount, pricing.currency)}`
                    : 'Create order'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function CustomerOrderDetail() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const [order, setOrder] = useState<Order | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastGpsAt, setLastGpsAt] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id || Number.isNaN(id)) {
      setError('Invalid order id')
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    try {
      const [o, p] = await Promise.all([
        userApi.getOrder(id),
        userApi.listParcels({ order_id: id }),
      ])
      setOrder(o.data)
      setParcels(p.data)
      setLastGpsAt(o.data.truck_location_updated_at || null)
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Poll tracking so customer sees START / STOP without refreshing
  usePolling(() => {
    if (order && order.driver_id != null) {
      void load({ silent: true })
    }
  }, 4000, !!order && order.driver_id != null)

  async function cancel() {
    if (!order) return
    if (!window.confirm(`Cancel order #${order.id}?`)) return
    setError(null)
    setSuccess(null)
    try {
      await userApi.cancelOrder(order.id)
      setSuccess('Order cancelled')
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  if (loading && !order) return <LoadingBlock />
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

  const steps = ['pending', 'assigned', 'in_transit', 'delivered']
  const currentIdx = steps.indexOf(order.status)
  const phase = journeyLabel(order.journey_phase)
  const showTracking =
    order.driver_id != null && order.status !== 'cancelled' && order.status !== 'delivered'

  return (
    <div className="page">
      <PageHeader
        title={`Order #${order.id}`}
        subtitle="Live delivery status, driver location map, and parcels"
        actions={
          <>
            <Link className="btn btn-ghost" to="/customer/orders">
              Back
            </Link>
            {order.status !== 'delivered' && order.status !== 'cancelled' ? (
              <Link className="btn btn-primary" to={`/customer/orders/${order.id}/pay`}>
                Pay with SafePay
              </Link>
            ) : null}
            <button className="btn btn-ghost" onClick={() => void load()}>
              Refresh tracking
            </button>
            {(order.status === 'pending' || order.status === 'assigned') && (
              <button className="btn btn-danger" onClick={cancel}>
                Cancel order
              </button>
            )}
          </>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {showTracking ? (
        <div className={`driver-assigned-card journey-${phase.tone}`}>
          <div>
            <div className="field-label">Driver journey</div>
            <h3 style={{ margin: '4px 0' }}>{phase.text}</h3>
            <div className="muted">
              {order.driver_name || `Driver #${order.driver_id}`}
              {order.truck_plate ? ` · Truck ${order.truck_plate}` : ''}
              {order.truck_status ? ` · ${titleCase(order.truck_status)}` : ''}
            </div>
            <div className="chip-row">
              <span className={`badge ${phase.tone}`}>{phase.text}</span>
              {order.truck_lat != null && order.truck_lng != null ? (
                <span className="badge info">
                  GPS {formatCoord(order.truck_lat, order.truck_lng)}
                </span>
              ) : (
                <span className="badge warn">Waiting for driver START / GPS</span>
              )}
              <span className="badge muted small">
                Last update: {formatDate(lastGpsAt || order.truck_location_updated_at)}
              </span>
            </div>
          </div>
          <div className="muted small">
            Map refreshes every 4s while the driver is on this delivery.
            <br />
            When driver taps <strong>START</strong> → “On the way”.
            <br />
            When driver taps <strong>PAUSE</strong> → “Stopped / paused” at last GPS point.
          </div>
        </div>
      ) : null}

      {showTracking ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Driver live location</h2>
            <span className="muted small">
              {order.truck_lat != null
                ? `Truck ${formatCoord(order.truck_lat, order.truck_lng)}`
                : 'No GPS yet'}
            </span>
          </div>
          <DriverTrackingMap order={order} height={400} />
        </section>
      ) : null}

      <div className="panel">
        <div className="status-badge-row">
          <StatusBadge value={order.status} />
          <span className={`badge ${phase.tone}`}>{phase.text}</span>
          <span className="muted">Updated {formatDate(order.updated_at)}</span>
        </div>

        {order.driver_id != null ? (
          <div className="driver-assigned-card">
            <div>
              <div className="field-label">Assigned driver</div>
              <h3 style={{ margin: '4px 0' }}>
                {order.driver_name || `Driver #${order.driver_id}`}
              </h3>
              <div className="muted">
                {order.driver_license ? `License ${order.driver_license}` : 'License —'}
                {order.driver_phone ? ` · ${order.driver_phone}` : ''}
              </div>
              <div className="chip-row">
                {order.truck_plate ? (
                  <span className="badge info">
                    Truck {order.truck_plate}
                    {order.truck_model ? ` · ${order.truck_model}` : ''}
                  </span>
                ) : null}
                <span className="badge ok">Driver assigned to your order</span>
              </div>
            </div>
            <div className="muted small">
              You will also see assignment updates in Notifications.
              <br />
              <Link to="/customer/notifications">Open notifications</Link>
            </div>
          </div>
        ) : (
          <div className="poll-banner">
            <span className="badge warn">Driver not assigned yet</span>
            <span>
              We will notify you as soon as operations assign a driver to this order.
            </span>
          </div>
        )}

        {(() => {
          const storedPricing = calculateDeliveryPricing({
            pickup_lat: order.pickup_lat,
            pickup_lng: order.pickup_lng,
            delivery_lat: order.delivery_lat,
            delivery_lng: order.delivery_lng,
            weight_kg: order.weight_kg ?? 0,
          })
          const display = {
            ...storedPricing,
            total_amount: order.amount ?? storedPricing.total_amount,
            currency: order.currency || storedPricing.currency,
            rate_per_km: order.rate_per_km ?? storedPricing.rate_per_km,
            distance_km: order.distance_km ?? storedPricing.distance_km,
            weight_kg: order.weight_kg ?? storedPricing.weight_kg,
            formula: order.pricing_formula || storedPricing.formula,
          }
          return (
            <div className="mt">
              <PricingBreakdownCard pricing={display} title="Delivery pricing" />
              <p className="muted small">
                Charge = distance × PKR 20/km · weight {MIN_WEIGHT_KG}–{MAX_WEIGHT_KG} kg
                {order.amount != null
                  ? ` · Amount on order: ${formatMoney(order.amount, order.currency || 'PKR')}`
                  : ''}
              </p>
            </div>
          )
        })()}

        <ol className="timeline">
          {steps.map((s, idx) => (
            <li
              key={s}
              className={
                order.status === 'cancelled'
                  ? 'muted'
                  : idx <= currentIdx
                    ? 'done'
                    : 'pending'
              }
            >
              <span className="dot" />
              {titleCase(s)}
            </li>
          ))}
          {order.status === 'cancelled' ? (
            <li className="danger">
              <span className="dot" />
              Cancelled
            </li>
          ) : null}
          {order.status === 'reassigned' ? (
            <li className="warn">
              <span className="dot" />
              Reassigned (recovery vehicle)
            </li>
          ) : null}
        </ol>

        <div className="detail-grid">
          <div>
            <span className="field-label">Pickup</span>
            <div>{order.pickup_address || '—'}</div>
            <div className="muted">{formatCoord(order.pickup_lat, order.pickup_lng)}</div>
          </div>
          <div>
            <span className="field-label">Delivery</span>
            <div>{order.delivery_address || '—'}</div>
            <div className="muted">{formatCoord(order.delivery_lat, order.delivery_lng)}</div>
          </div>
          <div>
            <span className="field-label">Deadline</span>
            <div>{formatDate(order.deadline)}</div>
          </div>
          <div>
            <span className="field-label">Driver</span>
            {order.driver_id != null ? (
              <div>
                <strong>{order.driver_name || `#${order.driver_id}`}</strong>
                <div className="muted small">
                  {order.driver_license || ''}
                  {order.driver_phone ? ` · ${order.driver_phone}` : ''}
                  {order.truck_plate ? ` · ${order.truck_plate}` : ''}
                </div>
              </div>
            ) : (
              <div className="muted">Not assigned yet</div>
            )}
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Parcels</h2>
        </div>
        {parcels.length === 0 ? (
          <p className="muted">No parcels recorded for this order.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Weight</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Truck</th>
                </tr>
              </thead>
              <tbody>
                {parcels.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.weight_kg} kg</td>
                    <td>{p.description || '—'}</td>
                    <td>
                      <StatusBadge value={p.status} />
                    </td>
                    <td>{p.truck_id != null ? `#${p.truck_id}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export function CustomerParcels() {
  const [items, setItems] = useState<Parcel[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, o] = await Promise.all([userApi.listParcels(), userApi.listOrders()])
      setItems(p.data)
      setOrders(o.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cancelledOrderIds = new Set(
    orders.filter((o) => o.status === 'cancelled').map((o) => o.id),
  )
  const visible = showCancelled
    ? items
    : items.filter((p) => !cancelledOrderIds.has(p.order_id))
  const hiddenCancelled = items.filter((p) => cancelledOrderIds.has(p.order_id)).length

  return (
    <div className="page">
      <PageHeader
        title="My Parcels"
        subtitle="Parcel status across your orders — created automatically with each order"
        actions={
          <button
            className={`btn ${showCancelled ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowCancelled((v) => !v)}
          >
            {showCancelled ? 'Hide cancelled' : 'Show cancelled orders'}
          </button>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!showCancelled && hiddenCancelled > 0 ? (
        <div className="poll-banner">
          <span className="badge muted">Cancelled hidden</span>
          <span>
            {hiddenCancelled} parcel(s) belong to cancelled orders and are not shown.
          </span>
        </div>
      ) : null}
      {loading ? (
        <LoadingBlock />
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="No parcels yet"
            description="A parcel is created automatically with every new order. Create an order, then open My Parcels or the order detail page to track weight and status."
            action={
              <Link className="btn btn-primary" to="/customer/orders/new">
                Create order
              </Link>
            }
          />
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Order</th>
                  <th>Weight</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <Link to={`/customer/orders/${p.order_id}`}>#{p.order_id}</Link>
                    </td>
                    <td>{p.weight_kg} kg</td>
                    <td>{p.description || '—'}</td>
                    <td>
                      <StatusBadge value={p.status} />
                    </td>
                    <td>{formatDate(p.updated_at)}</td>
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

export function CustomerNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCancelledRelated, setShowCancelledRelated] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const [n, o] = await Promise.all([
        userApi.listNotifications(),
        userApi.listOrders(),
      ])
      setItems(n.data)
      setOrders(o.data)
      setError(null)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  usePolling(() => void load({ silent: true }), POLL_INTERVALS.customerFeedMs)

  const cancelledOrderIds = new Set(
    orders.filter((o) => o.status === 'cancelled').map((o) => o.id),
  )
  const relatedToCancelled = (n: Notification) => {
    const text = `${n.title} ${n.message}`
    for (const id of cancelledOrderIds) {
      if (text.includes(`Order #${id}`) || text.includes(`order #${id}`)) return true
    }
    return false
  }

  const visibleItems = showCancelledRelated
    ? items
    : items.filter((n) => !relatedToCancelled(n))
  const hiddenCancelled = items.filter(relatedToCancelled).length

  async function markRead(id: number) {
    setBusy(true)
    setError(null)
    try {
      await userApi.markNotificationRead(id)
      setSuccess('Marked as read')
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle="Order updates for active deliveries — cancelled-order alerts are hidden"
        actions={
          <>
            <button
              className={`btn ${showCancelledRelated ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowCancelledRelated((v) => !v)}
            >
              {showCancelledRelated ? 'Hide cancelled' : 'Show cancelled history'}
            </button>
            <button className="btn btn-ghost" onClick={() => void load()}>
              Refresh
            </button>
          </>
        }
      />
      <div className="poll-banner">
        <span className="badge info">REST poll</span>
        <span>
          Auto-refresh every {POLL_INTERVALS.customerFeedMs / 1000}s · cancelled-order
          notifications are hidden from the dashboard
        </span>
      </div>
      {!showCancelledRelated && hiddenCancelled > 0 ? (
        <div className="poll-banner">
          <span className="badge muted">Cancelled hidden</span>
          <span>
            {hiddenCancelled} notification(s) related to cancelled orders are not shown. Use
            “Show cancelled history” if you need them.
          </span>
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}
      {loading ? (
        <LoadingBlock />
      ) : visibleItems.length === 0 ? (
        <div className="panel">
          <EmptyState title="No notifications" />
        </div>
      ) : (
        <div className="panel">
          <ul className="notification-list">
            {visibleItems.map((n) => (
              <li key={n.id} className={n.is_read ? 'read' : 'unread'}>
                <div>
                  <div className="chip-row">
                    <span className="badge info">{titleCase(n.type)}</span>
                    {showCancelledRelated && relatedToCancelled(n) ? (
                      <span className="badge muted">cancelled order</span>
                    ) : null}
                    <span className="muted small">{formatDate(n.created_at)}</span>
                  </div>
                  <strong>{n.title}</strong>
                  <div>{n.message}</div>
                </div>
                {!n.is_read ? (
                  <button
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => markRead(n.id)}
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="muted small">Read</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function CustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [form, setForm] = useState({ address: '', full_name: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    userApi
      .profile()
      .then((res) => {
        setProfile(res.data)
        setForm({
          address: res.data.address || '',
          full_name: res.data.user.full_name || '',
          phone: res.data.user.phone || '',
        })
      })
      .catch((err) => setError(extractError(err)))
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await userApi.updateProfile({
        address: form.address,
        full_name: form.full_name,
        phone: form.phone,
      })
      setProfile(res.data)
      setSuccess('Profile updated')
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="page narrow">
      <PageHeader title="Profile" subtitle="Your customer account details" />
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}
      <div className="panel">
        <div className="detail-grid">
          <div>
            <span className="field-label">Customer ID</span>
            <div>{profile?.id}</div>
          </div>
          <div>
            <span className="field-label">Email</span>
            <div>{profile?.user.email}</div>
          </div>
          <div>
            <span className="field-label">Role</span>
            <div>{profile?.user.role}</div>
          </div>
          <div>
            <span className="field-label">Member since</span>
            <div>{formatDate(profile?.created_at)}</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="stack mt">
          <Field label="Full name">
            <input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </Field>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
