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
import type { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '../../types'
import { formatDate } from '../../utils/format'

const TYPES: MaintenanceType[] = ['scheduled', 'emergency', 'inspection']
const STATUSES: MaintenanceStatus[] = ['scheduled', 'in_progress', 'completed']

export function AdminMaintenance() {
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [trucks, setTrucks] = useState<{ id: number; plate_number: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    truck_id: '',
    type: 'scheduled' as MaintenanceType,
    description: '',
    scheduled_at: '',
    status: 'scheduled' as MaintenanceStatus,
    completed_at: '',
  })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [m, t] = await Promise.all([adminApi.listMaintenance(), adminApi.listTrucks()])
      setItems(m.data)
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
    setForm({
      truck_id: '',
      type: 'scheduled',
      description: '',
      scheduled_at: '',
      status: 'scheduled',
      completed_at: '',
    })
    setModalOpen(true)
  }

  function openEdit(record: MaintenanceRecord) {
    setEditing(record)
    setForm({
      truck_id: String(record.truck_id),
      type: record.type,
      description: record.description || '',
      scheduled_at: record.scheduled_at ? record.scheduled_at.slice(0, 16) : '',
      status: record.status,
      completed_at: record.completed_at ? record.completed_at.slice(0, 16) : '',
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
        await adminApi.updateMaintenance(editing.id, {
          description: form.description || null,
          status: form.status,
          scheduled_at: form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : undefined,
          completed_at: form.completed_at
            ? new Date(form.completed_at).toISOString()
            : undefined,
        })
        setSuccess(`Maintenance #${editing.id} updated`)
      } else {
        await adminApi.createMaintenance({
          truck_id: Number(form.truck_id),
          type: form.type,
          description: form.description || null,
          scheduled_at: form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : null,
        })
        setSuccess('Maintenance record created')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(record: MaintenanceRecord) {
    if (!window.confirm(`Delete maintenance record #${record.id}?`)) return
    try {
      await adminApi.deleteMaintenance(record.id)
      setSuccess(`Maintenance #${record.id} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Maintenance"
        subtitle="Scheduled service, inspections, and emergency repairs"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            + Add record
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
                  <th>Truck</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Scheduled</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>
                      {trucks.find((t) => t.id === m.truck_id)?.plate_number || `#${m.truck_id}`}
                    </td>
                    <td>{m.type}</td>
                    <td>
                      <StatusBadge value={m.status} />
                    </td>
                    <td className="truncate">{m.description || '—'}</td>
                    <td>{formatDate(m.scheduled_at)}</td>
                    <td>{formatDate(m.completed_at)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => openEdit(m)}>
                        Edit
                      </button>
                      <button className="btn btn-sm danger" onClick={() => remove(m)}>
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
        title={editing ? `Edit maintenance #${editing.id}` : 'Create maintenance'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="stack">
          <Field label="Truck">
            <select
              value={form.truck_id}
              onChange={(e) => setForm((f) => ({ ...f, truck_id: e.target.value }))}
              required
              disabled={!!editing}
            >
              <option value="">Select truck…</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.plate_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MaintenanceType }))}
              disabled={!!editing}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </Field>
          <Field label="Scheduled at">
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
            />
          </Field>
          {editing ? (
            <>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as MaintenanceStatus }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Completed at">
                <input
                  type="datetime-local"
                  value={form.completed_at}
                  onChange={(e) => setForm((f) => ({ ...f, completed_at: e.target.value }))}
                />
              </Field>
            </>
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

export function AdminUsers() {
  const [items, setItems] = useState<
    { id: number; email: string; full_name: string; phone: string | null; role: string; is_active: boolean; created_at: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<(typeof items)[number] | null>(null)
  const [form, setForm] = useState({ full_name: '', phone: '', role: 'customer', is_active: true })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.listUsers(roleFilter ? { role: roleFilter } : undefined)
      setItems(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [roleFilter])

  function openEdit(user: (typeof items)[number]) {
    setEditing(user)
    setForm({
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active,
    })
    setModalOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await adminApi.updateUser(editing.id, {
        full_name: form.full_name,
        phone: form.phone || undefined,
        role: form.role,
        is_active: form.is_active,
      })
      setSuccess(`User #${editing.id} updated`)
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Users" subtitle="Accounts, roles, and active status" />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">Role</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All</option>
            <option value="admin">admin</option>
            <option value="driver">driver</option>
            <option value="customer">customer</option>
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
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <StatusBadge value={u.role === 'admin' ? 'available' : u.role === 'driver' ? 'on_delivery' : 'pending'} />
                      <span className="badge muted">{u.role}</span>
                    </td>
                    <td>{u.is_active ? 'Yes' : 'No'}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openEdit(u)}>
                        Edit
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
        title={editing ? `Edit user #${editing.id}` : 'Edit user'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="stack">
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
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="admin">admin</option>
              <option value="driver">driver</option>
              <option value="customer">customer</option>
            </select>
          </Field>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active account
          </label>
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
