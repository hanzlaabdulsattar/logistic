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
import type { Customer, Parcel, ParcelStatus } from '../../types'
import { formatDate } from '../../utils/format'

const PARCEL_STATUSES: ParcelStatus[] = ['pending', 'loaded', 'in_transit', 'delivered', 'transferred']

export function AdminCustomers() {
  const [items, setItems] = useState<Customer[]>([])
  const [users, setUsers] = useState<{ id: number; full_name: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ user_id: '', address: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [c, u] = await Promise.all([
        adminApi.listCustomers(),
        adminApi.listUsers({ role: 'customer' }),
      ])
      setItems(c.data)
      setUsers(u.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ user_id: '', address: '' })
    setModalOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditing(customer)
    setForm({
      user_id: String(customer.user_id),
      address: customer.address || '',
    })
    setModalOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (editing) {
        await adminApi.updateCustomer(editing.id, { address: form.address || null })
        setSuccess(`Customer #${editing.id} updated`)
      } else {
        await adminApi.createCustomer({
          user_id: Number(form.user_id),
          address: form.address || null,
        })
        setSuccess('Customer created')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(`Delete customer #${customer.id}?`)) return
    try {
      await adminApi.deleteCustomer(customer.id)
      setSuccess(`Customer #${customer.id} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Customers"
        subtitle="Customer profiles linked to user accounts"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            + Add customer
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Address</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>
                      <div>
                        {users.find((u) => u.id === c.user_id)?.full_name || `User #${c.user_id}`}
                      </div>
                      <div className="muted small">
                        {users.find((u) => u.id === c.user_id)?.email || ''}
                      </div>
                    </td>
                    <td>{c.address || '—'}</td>
                    <td>{formatDate(c.created_at)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button className="btn btn-sm danger" onClick={() => remove(c)}>
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
        title={editing ? `Edit customer #${editing.id}` : 'Create customer'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="stack">
          {!editing ? (
            <Field label="User account" hint="Register a customer-role user first">
              <select
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                required
              >
                <option value="">Select user…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.id} — {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function AdminParcels() {
  const [items, setItems] = useState<Parcel[]>([])
  const [orders, setOrders] = useState<{ id: number; customer_id: number }[]>([])
  const [trucks, setTrucks] = useState<{ id: number; plate_number: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Parcel | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    order_id: '',
    truck_id: '',
    weight_kg: 100,
    description: '',
    status: 'pending' as ParcelStatus,
  })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, o, t] = await Promise.all([
        adminApi.listParcels(),
        adminApi.listOrders(),
        adminApi.listTrucks(),
      ])
      setItems(p.data)
      setOrders(o.data)
      setTrucks(t.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ order_id: '', truck_id: '', weight_kg: 100, description: '', status: 'pending' })
    setModalOpen(true)
  }

  function openEdit(parcel: Parcel) {
    setEditing(parcel)
    setForm({
      order_id: String(parcel.order_id),
      truck_id: parcel.truck_id != null ? String(parcel.truck_id) : '',
      weight_kg: parcel.weight_kg,
      description: parcel.description || '',
      status: parcel.status,
    })
    setModalOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const truckId = form.truck_id ? Number(form.truck_id) : null
      if (editing) {
        await adminApi.updateParcel(editing.id, {
          truck_id: truckId,
          weight_kg: Number(form.weight_kg),
          description: form.description || null,
          status: form.status,
        })
        setSuccess(`Parcel #${editing.id} updated`)
      } else {
        await adminApi.createParcel({
          order_id: Number(form.order_id),
          truck_id: truckId,
          weight_kg: Number(form.weight_kg),
          description: form.description || null,
        })
        setSuccess('Parcel created')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(parcel: Parcel) {
    if (!window.confirm(`Delete parcel #${parcel.id}?`)) return
    try {
      await adminApi.deleteParcel(parcel.id)
      setSuccess(`Parcel #${parcel.id} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Parcels"
        subtitle="Parcel weight, assignment, and transfer status"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            + Add parcel
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Order</th>
                  <th>Truck</th>
                  <th>Weight</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>#{p.order_id}</td>
                    <td>
                      {p.truck_id
                        ? trucks.find((t) => t.id === p.truck_id)?.plate_number || `#${p.truck_id}`
                        : '—'}
                    </td>
                    <td>{p.weight_kg} kg</td>
                    <td className="truncate">{p.description || '—'}</td>
                    <td>
                      <StatusBadge value={p.status} />
                    </td>
                    <td>{formatDate(p.updated_at)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => openEdit(p)}>
                        Edit
                      </button>
                      <button className="btn btn-sm danger" onClick={() => remove(p)}>
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
        title={editing ? `Edit parcel #${editing.id}` : 'Create parcel'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="stack">
          <Field label="Order">
            <select
              value={form.order_id}
              onChange={(e) => setForm((f) => ({ ...f, order_id: e.target.value }))}
              required
              disabled={!!editing}
            >
              <option value="">Select order…</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} — customer #{o.customer_id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Truck">
            <select
              value={form.truck_id}
              onChange={(e) => setForm((f) => ({ ...f, truck_id: e.target.value }))}
            >
              <option value="">None</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.plate_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Weight (kg)">
            <input
              type="number"
              step="any"
              min={0}
              value={form.weight_kg}
              onChange={(e) => setForm((f) => ({ ...f, weight_kg: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          {editing ? (
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ParcelStatus }))}
              >
                {PARCEL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
