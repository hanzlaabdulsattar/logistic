import { useEffect, useState, type FormEvent } from 'react'
import { adminApi } from '../../api/endpoints'
import { extractError } from '../../api/client'
import {
  ErrorBanner,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import { PricingBreakdownCard } from '../../components/PricingCard'
import type { Order, OrderStatus } from '../../types'
import { formatDate } from '../../utils/format'
import {
  MAX_DISTANCE_KM,
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
  RATE_PER_KM,
  calculateDeliveryPricing,
  formatMoney,
  parseWeightKg,
  validateWeight,
  type PricingBreakdown,
} from '../../utils/pricing'

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'assigned',
  'in_transit',
  'delivered',
  'cancelled',
  'reassigned',
]

export function AdminOrders() {
  const [items, setItems] = useState<Order[]>([])
  const [customers, setCustomers] = useState<{ id: number; user_id: number }[]>([])
  const [drivers, setDrivers] = useState<{
    id: number
    user_id: number
    license_number: string
    truck_id?: number | null
    status?: string
  }[]>([])
  const [driverUsers, setDriverUsers] = useState<
    { id: number; full_name: string; email: string }[]
  >([])
  const [trucks, setTrucks] = useState<{ id: number; plate_number: string }[]>([])
  const [workload, setWorkload] = useState<
    {
      driver_id: number
      name: string
      status: string
      open_orders: number
    }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    driver_id: '',
    status: 'pending' as OrderStatus,
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    pickup_lat: 31.5204,
    pickup_lng: 74.3587,
    delivery_lat: 33.6844,
    delivery_lng: 73.0479,
    pickup_address: '',
    delivery_address: '',
    deadline: '',
    weight_kg: '5',
    fragile: false,
  })

  function driverLabel(driverId: number | null): string {
    if (driverId == null) return 'Unassigned'
    const d = drivers.find((x) => x.id === driverId)
    const u = driverUsers.find((x) => x.id === d?.user_id)
    const plate =
      d?.truck_id != null
        ? trucks.find((t) => t.id === d.truck_id)?.plate_number
        : undefined
    const name = u?.full_name || `Driver #${driverId}`
    return plate ? `${name} · ${plate}` : name
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [o, c, d, u, t, w] = await Promise.all([
        adminApi.listOrders(statusFilter ? { status: statusFilter } : undefined),
        adminApi.listCustomers(),
        adminApi.listDrivers(),
        adminApi.listUsers({ role: 'driver' }),
        adminApi.listTrucks(),
        adminApi.driverWorkload().catch(() => ({ data: { drivers: [] } })),
      ])
      setItems(o.data)
      setCustomers(c.data)
      setDrivers(d.data)
      setDriverUsers(u.data)
      setTrucks(t.data)
      setWorkload(w.data.drivers || [])
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [statusFilter])

  function openCreate() {
    setEditing(null)
    setForm({
      customer_id: '',
      driver_id: '',
      status: 'pending',
      priority: 'normal',
      pickup_lat: 31.5204,
      pickup_lng: 74.3587,
      delivery_lat: 33.6844,
      delivery_lng: 73.0479,
      pickup_address: '',
      delivery_address: '',
      deadline: '',
      weight_kg: '5',
      fragile: false,
    })
    setModalOpen(true)
  }

  function openEdit(order: Order) {
    setEditing(order)
    setForm({
      customer_id: String(order.customer_id),
      driver_id: order.driver_id != null ? String(order.driver_id) : '',
      status: order.status,
      priority: order.priority || 'normal',
      pickup_lat: order.pickup_lat,
      pickup_lng: order.pickup_lng,
      delivery_lat: order.delivery_lat,
      delivery_lng: order.delivery_lng,
      pickup_address: order.pickup_address || '',
      delivery_address: order.delivery_address || '',
      deadline: order.deadline ? order.deadline.slice(0, 16) : '',
      weight_kg: String(order.weight_kg ?? 5),
      fragile: !!order.fragile,
    })
    setModalOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const weight = parseWeightKg(form.weight_kg)
      const wErr = validateWeight(weight)
      if (wErr) {
        setError(wErr)
        setBusy(false)
        return
      }
      const pricing: PricingBreakdown = calculateDeliveryPricing({
        pickup_lat: Number(form.pickup_lat),
        pickup_lng: Number(form.pickup_lng),
        delivery_lat: Number(form.delivery_lat),
        delivery_lng: Number(form.delivery_lng),
        weight_kg: weight,
      })
      if (!pricing.distance_valid || pricing.limit_exceeded) {
        setError(
          pricing.distance_error ||
            `Distance limit exceeded — max delivery distance is ${MAX_DISTANCE_KM} km`,
        )
        setBusy(false)
        return
      }
      const payload = {
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
        amount: pricing.total_amount,
        currency: pricing.currency,
        distance_km: pricing.distance_km,
        rate_per_km: pricing.rate_per_km,
        rate_per_kg: 0,
        base_fee: 0,
        handling_fee: 0,
        pricing_formula: pricing.formula,
      }
      let status = form.status
      if (form.driver_id && (status === 'pending' || !status)) {
        status = 'assigned'
      }
      if (editing) {
        await adminApi.updateOrder(editing.id, {
          ...payload,
          driver_id: form.driver_id ? Number(form.driver_id) : null,
          status,
        })
        setSuccess(
          form.driver_id
            ? `Order #${editing.id} assigned manually to ${driverLabel(Number(form.driver_id))}`
            : `Order #${editing.id} auto-assigned by least-loaded hierarchy · ${formatMoney(pricing.total_amount, pricing.currency)}`,
        )
      } else {
        await adminApi.createOrder({
          ...payload,
          customer_id: Number(form.customer_id),
          driver_id: form.driver_id ? Number(form.driver_id) : null,
        })
        setSuccess(
          form.driver_id
            ? `Order created — admin assigned to ${driverLabel(Number(form.driver_id))} · ${formatMoney(pricing.total_amount, pricing.currency)}`
            : `Order created — auto-assigned · ${formatMoney(pricing.total_amount, pricing.currency)}`,
        )
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(order: Order) {
    if (!window.confirm(`Delete order #${order.id}?`)) return
    try {
      await adminApi.deleteOrder(order.id)
      setSuccess(`Order #${order.id} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const unassignedCount = items.filter((o) => o.driver_id == null).length

  async function bulkAssign() {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await adminApi.assignUnassignedOrders()
      setSuccess(res.data.message || `Assigned ${res.data.assigned} order(s)`)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function reassignToFirstOther(order: Order) {
    if (!order.driver_id) {
      setError('Order has no current driver — use Assign driver instead')
      return
    }
    const target = drivers.find((d) => d.id !== order.driver_id && d.status !== 'suspended')
    if (!target) {
      setError('No other eligible driver available to reassign to')
      return
    }
    if (!window.confirm(`Reassign order #${order.id} to ${driverLabel(target.id)}?`)) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await adminApi.reassignOrder(order.id, target.id, 'Admin reassignment')
      setSuccess(`Order #${order.id} reassigned to ${driverLabel(target.id)}`)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Orders"
        subtitle="Create orders and assign drivers — customers see the assigned driver automatically"
        actions={
          <>
            <button className="btn btn-warn" onClick={bulkAssign} disabled={busy}>
              Assign unassigned orders
            </button>
            <button className="btn btn-primary" onClick={openCreate}>
              + Create order
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="poll-banner">
        <span className="badge info">Assignment hierarchy</span>
        <span>
          <strong>1.</strong> Admin manual pick always wins →{' '}
          <strong>2.</strong> Auto (if driver left empty): available drivers → have truck →{' '}
          <strong>least open orders</strong> → lower ID →{' '}
          <strong>3.</strong> Driver reject uses the same auto rules (skips rejector).
          {unassignedCount > 0
            ? ` (${unassignedCount} unassigned — Assign unassigned uses hierarchy)`
            : ''}
        </span>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Driver workload (open orders)</h2>
          <span className="muted small">Used by auto hierarchy — lowest open_orders wins</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Status</th>
                <th>Open orders</th>
                <th>Eligible for auto?</th>
              </tr>
            </thead>
            <tbody>
              {workload.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No drivers loaded yet.
                  </td>
                </tr>
              ) : (
                workload.map((wrow) => (
                  <tr key={wrow.driver_id}>
                    <td>
                      <strong>{wrow.name}</strong>
                      <div className="muted small">#{wrow.driver_id}</div>
                    </td>
                    <td>
                      <span className={`badge ${wrow.status === 'available' ? 'ok' : 'info'}`}>
                        {wrow.status}
                      </span>
                    </td>
                    <td>
                      <strong>{wrow.open_orders}</strong>
                    </td>
                    <td>
                      {wrow.status === 'available' || wrow.status === 'on_delivery'
                        ? wrow.open_orders === 0
                          ? 'Yes — first choice'
                          : 'Yes — after less busy drivers'
                        : 'No — suspended / on leave'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Priority</th>
                  <th>Customer</th>
                  <th>Assigned driver</th>
                  <th>Status</th>
                  <th>Pickup</th>
                  <th>Delivery</th>
                  <th>Deadline</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>
                      <span
                        className={`badge ${
                          o.priority === 'urgent'
                            ? 'danger'
                            : o.priority === 'high'
                              ? 'warn'
                              : 'muted'
                        }`}
                      >
                        {o.priority || 'normal'}
                      </span>
                    </td>
                    <td>
                      #{o.customer_id}
                      {customers.find((c) => c.id === o.customer_id)
                        ? ` (user ${customers.find((c) => c.id === o.customer_id)?.user_id})`
                        : ''}
                    </td>
                    <td>
                      {o.driver_id != null ? (
                        <div>
                          <strong>{driverLabel(o.driver_id)}</strong>
                          <div className="muted small">
                            Driver #{o.driver_id}
                            {drivers.find((d) => d.id === o.driver_id)?.license_number
                              ? ` · ${drivers.find((d) => d.id === o.driver_id)?.license_number}`
                              : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="badge warn">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge value={o.status} />
                    </td>
                    <td>
                      <div>
                        {o.pickup_address ||
                          `${o.pickup_lat.toFixed(3)}, ${o.pickup_lng.toFixed(3)}`}
                      </div>
                    </td>
                    <td>
                      <div>
                        {o.delivery_address ||
                          `${o.delivery_lat.toFixed(3)}, ${o.delivery_lng.toFixed(3)}`}
                      </div>
                    </td>
                    <td>{formatDate(o.deadline)}</td>
                    <td>{formatDate(o.created_at)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => openEdit(o)}>
                        {o.driver_id == null ? 'Assign driver' : 'Edit'}
                      </button>
                      {o.driver_id != null &&
                      o.status !== 'delivered' &&
                      o.status !== 'cancelled' ? (
                        <button
                          className="btn btn-sm warn"
                          disabled={busy}
                          onClick={() => void reassignToFirstOther(o)}
                        >
                          Reassign
                        </button>
                      ) : null}
                      <button className="btn btn-sm danger" onClick={() => remove(o)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={
          editing
            ? editing.driver_id == null
              ? `Assign driver to order #${editing.id}`
              : `Edit order #${editing.id}`
            : 'Create order'
        }
        onClose={() => setModalOpen(false)}
        wide
      >
        <form onSubmit={onSubmit} className="grid-form">
          {!editing ? (
            <Field label="Customer">
              <select
                value={form.customer_id}
                onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                required
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    Customer #{c.id} (user {c.user_id})
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field
            label="Assign driver"
            hint="Leave empty = auto hierarchy (available → truck → least open orders). Pick a driver = admin manual (wins)."
          >
            <select
              value={form.driver_id}
              onChange={(e) => {
                const val = e.target.value
                setForm((f) => ({
                  ...f,
                  driver_id: val,
                  status:
                    val && (f.status === 'pending' || !f.status) ? 'assigned' : f.status,
                }))
              }}
            >
              <option value="">— Auto (least loaded available) —</option>
              {drivers.map((d) => {
                const u = driverUsers.find((x) => x.id === d.user_id)
                const plate =
                  d.truck_id != null
                    ? trucks.find((t) => t.id === d.truck_id)?.plate_number
                    : null
                const load = workload.find((w) => w.driver_id === d.id)?.open_orders ?? 0
                return (
                  <option key={d.id} value={d.id}>
                    {u?.full_name || `Driver #${d.id}`} · {d.license_number}
                    {plate ? ` · ${plate}` : ''} · open={load} · {d.status}
                  </option>
                )
              })}
            </select>
          </Field>
          <Field label="Order status">
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as OrderStatus }))
              }
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" hint="Assignment order only — charge is PKR 20/km">
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as typeof form.priority,
                }))
              }
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </Field>
          <Field
            label="Parcel weight (kg)"
            hint={`Min ${MIN_WEIGHT_KG} kg (no maximum)`}
          >
            <input
              type="number"
              min={MIN_WEIGHT_KG}
              step="0.5"
              value={form.weight_kg}
              onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
            />
          </Field>
          <Field label="Fragile">
            <select
              value={form.fragile ? 'yes' : 'no'}
              onChange={(e) =>
                setForm((f) => ({ ...f, fragile: e.target.value === 'yes' }))
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          {(() => {
            const p = calculateDeliveryPricing({
              pickup_lat: Number(form.pickup_lat),
              pickup_lng: Number(form.pickup_lng),
              delivery_lat: Number(form.delivery_lat),
              delivery_lng: Number(form.delivery_lng),
              weight_kg: parseWeightKg(form.weight_kg),
            })
            return (
              <div className="full-span">
                <PricingBreakdownCard pricing={p} title={`Delivery charge (PKR ${RATE_PER_KM}/km)`} />
              </div>
            )
          })()}
          <Field label="Deadline">
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </Field>
          <Field label="Pickup address">
            <input
              value={form.pickup_address}
              onChange={(e) => setForm((f) => ({ ...f, pickup_address: e.target.value }))}
            />
          </Field>
          <Field label="Delivery address">
            <input
              value={form.delivery_address}
              onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
            />
          </Field>
          <Field label="Pickup lat">
            <input
              type="number"
              step="any"
              value={form.pickup_lat}
              onChange={(e) => setForm((f) => ({ ...f, pickup_lat: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Pickup lng">
            <input
              type="number"
              step="any"
              value={form.pickup_lng}
              onChange={(e) => setForm((f) => ({ ...f, pickup_lng: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Delivery lat">
            <input
              type="number"
              step="any"
              value={form.delivery_lat}
              onChange={(e) => setForm((f) => ({ ...f, delivery_lat: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Delivery lng">
            <input
              type="number"
              step="any"
              value={form.delivery_lng}
              onChange={(e) => setForm((f) => ({ ...f, delivery_lng: Number(e.target.value) }))}
              required
            />
          </Field>
          <div className="modal-actions full-span">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : form.driver_id ? 'Save & assign driver' : 'Save order'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
