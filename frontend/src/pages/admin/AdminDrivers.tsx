import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
import type { Driver, DriverStatus, Truck } from '../../types'
import { formatDate } from '../../utils/format'

const DRIVER_STATUSES: DriverStatus[] = ['available', 'on_delivery', 'on_leave', 'suspended']

type DriverUser = { id: number; full_name: string; email: string; role: string }

export function AdminDrivers() {
  const [items, setItems] = useState<Driver[]>([])
  const [users, setUsers] = useState<DriverUser[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [assignDriver, setAssignDriver] = useState<Driver | null>(null)
  const [approveUser, setApproveUser] = useState<DriverUser | null>(null)
  const [form, setForm] = useState({
    user_id: '',
    license_number: '',
    truck_id: '',
    status: 'available' as DriverStatus,
  })
  const [assignForm, setAssignForm] = useState({ truck_id: '', license_number: '' })
  const [newTruck, setNewTruck] = useState({ plate_number: '', model: '', capacity_kg: 8000 })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [d, u, t] = await Promise.all([
        adminApi.listDrivers(),
        adminApi.listUsers({ role: 'driver' }),
        adminApi.listTrucks(),
      ])
      setItems(d.data)
      setUsers(u.data)
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

  /** Driver-role users who still need a profile (or profile has no truck). */
  const pending = useMemo(() => {
    const profiledUserIds = new Set(items.map((d) => d.user_id))
    const noProfile = users.filter((u) => !profiledUserIds.has(u.id))
    const noTruck = items.filter((d) => d.truck_id == null)
    return { noProfile, noTruck }
  }, [items, users])

  function openCreate() {
    setEditing(null)
    // Prefer users without a driver profile
    const profiled = new Set(items.map((d) => d.user_id))
    const candidate = users.find((u) => !profiled.has(u.id))?.id
    setForm({
      user_id: candidate != null ? String(candidate) : '',
      license_number: '',
      truck_id: '',
      status: 'available',
    })
    setModalOpen(true)
  }

  function openEdit(driver: Driver) {
    setEditing(driver)
    setForm({
      user_id: String(driver.user_id),
      license_number: driver.license_number,
      truck_id: driver.truck_id != null ? String(driver.truck_id) : '',
      status: driver.status,
    })
    setModalOpen(true)
  }

  function openApprove(user: DriverUser) {
    setApproveUser(user)
    setAssignForm({ truck_id: '', license_number: '' })
    setNewTruck({ plate_number: '', model: '', capacity_kg: 8000 })
    setApproveOpen(true)
  }

  function openAssign(driver: Driver) {
    setAssignDriver(driver)
    setAssignForm({
      truck_id: driver.truck_id != null ? String(driver.truck_id) : '',
      license_number: driver.license_number,
    })
    setNewTruck({ plate_number: '', model: '', capacity_kg: 8000 })
    setAssignOpen(true)
  }

  async function ensureTruck(truckId: string): Promise<number | null> {
    if (truckId) return Number(truckId)
    if (!newTruck.plate_number.trim()) return null
    const created = await adminApi.createTruck({
      plate_number: newTruck.plate_number.trim(),
      model: newTruck.model.trim() || 'Truck',
      capacity_kg: Number(newTruck.capacity_kg) || 5000,
    })
    return created.data.id
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const truckId = form.truck_id ? Number(form.truck_id) : null
      if (editing) {
        await adminApi.updateDriver(editing.id, {
          license_number: form.license_number,
          truck_id: truckId,
          status: form.status,
        })
        setSuccess(`Driver #${editing.id} updated`)
      } else {
        await adminApi.createDriver({
          user_id: Number(form.user_id),
          license_number: form.license_number,
          truck_id: truckId,
        })
        setSuccess('Driver profile created')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onApprove(e: FormEvent) {
    e.preventDefault()
    if (!approveUser) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const truckId = await ensureTruck(assignForm.truck_id)
      await adminApi.createDriver({
        user_id: approveUser.id,
        license_number: assignForm.license_number.trim() || `LIC-${approveUser.id}`,
        truck_id: truckId,
      })
      setSuccess(
        truckId
          ? `Approved ${approveUser.email} and assigned truck #${truckId}`
          : `Approved ${approveUser.email} (no truck selected)`,
      )
      setApproveOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault()
    if (!assignDriver) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const truckId = await ensureTruck(assignForm.truck_id)
      if (truckId == null) {
        setError('Select a truck or enter a new plate number to register one')
        setBusy(false)
        return
      }
      await adminApi.updateDriver(assignDriver.id, {
        truck_id: truckId,
        license_number: assignForm.license_number || assignDriver.license_number,
        status: 'available',
      })
      setSuccess(`Truck assigned to driver #${assignDriver.id}`)
      setAssignOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(driver: Driver) {
    if (!window.confirm(`Delete driver #${driver.id}?`)) return
    try {
      await adminApi.deleteDriver(driver.id)
      setSuccess(`Driver #${driver.id} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function changeStatus(driver: Driver, status: DriverStatus) {
    setError(null)
    try {
      await adminApi.updateDriver(driver.id, { status })
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Drivers"
        subtitle="Approve driver accounts, register trucks, and assign vehicles"
        actions={
          <>
            <Link className="btn btn-ghost" to="/admin/trucks">
              Manage trucks
            </Link>
            <button className="btn btn-primary" onClick={openCreate}>
              + Add driver
            </button>
          </>
        }
      />

      <div className="poll-banner">
        <span className="badge info">Required steps</span>
        <span>
          <strong>1.</strong> Register truck on{' '}
          <Link to="/admin/trucks">Trucks</Link> (or create inline below) →{' '}
          <strong>2.</strong> Approve driver / assign truck on this page →{' '}
          <strong>3.</strong> Assign that driver to an order on{' '}
          <Link to="/admin/orders">Orders</Link>.
        </span>
      </div>

      {pending.noProfile.length > 0 || pending.noTruck.length > 0 ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <strong>Needs attention</strong>
            <div className="muted small">
              Driver registered but profile incomplete — approve and assign a truck
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>User / Driver</th>
                  <th>Email</th>
                  <th>Truck</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.noProfile.map((u) => (
                  <tr key={`np-${u.id}`}>
                    <td>
                      <span className="badge warn">Pending approval</span>
                    </td>
                    <td>
                      {u.full_name}
                      <div className="muted small">User #{u.id}</div>
                    </td>
                    <td>{u.email}</td>
                    <td>—</td>
                    <td className="actions">
                      <button className="btn btn-sm btn-primary" onClick={() => openApprove(u)}>
                        Approve & assign truck
                      </button>
                    </td>
                  </tr>
                ))}
                {pending.noTruck.map((d) => (
                  <tr key={`nt-${d.id}`}>
                    <td>
                      <span className="badge warn">No truck</span>
                    </td>
                    <td>
                      Driver #{d.id}
                      <div className="muted small">{d.license_number}</div>
                    </td>
                    <td>{users.find((u) => u.id === d.user_id)?.email || `User #${d.user_id}`}</td>
                    <td>
                      <span className="badge danger">Unassigned</span>
                    </td>
                    <td className="actions">
                      <button className="btn btn-sm btn-primary" onClick={() => openAssign(d)}>
                        Assign truck
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

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
                  <th>License</th>
                  <th>Truck</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <strong>No driver profiles yet</strong>
                        <div className="muted small">
                          Register a truck first, then approve drivers from “Needs attention”.
                        </div>
                        <Link className="btn btn-primary" to="/admin/trucks" style={{ marginTop: 8 }}>
                          Register a truck
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>
                        <div>{users.find((u) => u.id === d.user_id)?.full_name || `User #${d.user_id}`}</div>
                        <div className="muted small">
                          {users.find((u) => u.id === d.user_id)?.email || ''}
                        </div>
                      </td>
                      <td>{d.license_number}</td>
                      <td>
                        {d.truck_id ? (
                          trucks.find((t) => t.id === d.truck_id)?.plate_number || `#${d.truck_id}`
                        ) : (
                          <span className="badge danger">No truck</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge value={d.status} />
                        <select
                          className="status-select"
                          value={d.status}
                          onChange={(e) => changeStatus(d, e.target.value as DriverStatus)}
                        >
                          {DRIVER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{formatDate(d.created_at)}</td>
                      <td className="actions">
                        {d.truck_id == null ? (
                          <button className="btn btn-sm btn-primary" onClick={() => openAssign(d)}>
                            Assign truck
                          </button>
                        ) : null}
                        <button className="btn btn-sm" onClick={() => openEdit(d)}>
                          Edit
                        </button>
                        <button className="btn btn-sm danger" onClick={() => remove(d)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / edit driver profile */}
      <Modal
        open={modalOpen}
        title={editing ? `Edit driver #${editing.id}` : 'Create driver profile'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="stack">
          {!editing ? (
            <Field label="Driver user account" hint="Must be role=driver (from Register page)">
              <select
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                required
              >
                <option value="">Select user…</option>
                {users.map((u) => {
                  const hasProfile = items.some((d) => d.user_id === u.id)
                  return (
                    <option key={u.id} value={u.id}>
                      #{u.id} — {u.full_name} ({u.email})
                      {hasProfile ? ' [has profile]' : ' [new]'}
                    </option>
                  )
                })}
              </select>
            </Field>
          ) : null}
          <Field label="License number">
            <input
              value={form.license_number}
              onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
              required
            />
          </Field>
          <Field label="Assign truck" hint="No trucks yet? Register one from Trucks page first">
            <select
              value={form.truck_id}
              onChange={(e) => setForm((f) => ({ ...f, truck_id: e.target.value }))}
            >
              <option value="">None (assign later)</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.plate_number} ({t.model})
                </option>
              ))}
            </select>
          </Field>
          {trucks.length === 0 ? (
            <div className="muted small">
              No trucks registered yet.{' '}
              <Link to="/admin/trucks">Go to Trucks → + Add truck</Link>
            </div>
          ) : null}
          {editing ? (
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DriverStatus }))}
              >
                {DRIVER_STATUSES.map((s) => (
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

      {/* Approve pending driver user */}
      <Modal
        open={approveOpen}
        title={approveUser ? `Approve ${approveUser.email}` : 'Approve driver'}
        onClose={() => setApproveOpen(false)}
      >
        <form onSubmit={onApprove} className="stack">
          <div className="muted small">
            Creates a driver profile for this user and optionally assigns a truck (register a new
            truck inline if needed).
          </div>
          <Field label="License number">
            <input
              value={assignForm.license_number}
              onChange={(e) => setAssignForm((f) => ({ ...f, license_number: e.target.value }))}
              placeholder={`LIC-${approveUser?.id ?? ''}`}
            />
          </Field>
          <Field label="Existing truck">
            <select
              value={assignForm.truck_id}
              onChange={(e) => setAssignForm((f) => ({ ...f, truck_id: e.target.value }))}
            >
              <option value="">— Register new truck below —</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.plate_number}
                </option>
              ))}
            </select>
          </Field>
          {!assignForm.truck_id ? (
            <>
              <Field label="New truck plate">
                <input
                  value={newTruck.plate_number}
                  onChange={(e) => setNewTruck((f) => ({ ...f, plate_number: e.target.value }))}
                  placeholder="LHR-1001"
                  required
                />
              </Field>
              <Field label="Truck model">
                <input
                  value={newTruck.model}
                  onChange={(e) => setNewTruck((f) => ({ ...f, model: e.target.value }))}
                  placeholder="Hino 300"
                />
              </Field>
              <Field label="Capacity (kg)">
                <input
                  type="number"
                  min={1}
                  value={newTruck.capacity_kg}
                  onChange={(e) => setNewTruck((f) => ({ ...f, capacity_kg: Number(e.target.value) }))}
                />
              </Field>
            </>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setApproveOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Approve driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign truck to existing driver */}
      <Modal
        open={assignOpen}
        title={assignDriver ? `Assign truck — driver #${assignDriver.id}` : 'Assign truck'}
        onClose={() => setAssignOpen(false)}
      >
        <form onSubmit={onAssign} className="stack">
          <Field label="Existing truck">
            <select
              value={assignForm.truck_id}
              onChange={(e) => setAssignForm((f) => ({ ...f, truck_id: e.target.value }))}
            >
              <option value="">— Register new truck below —</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.plate_number} ({t.model})
                </option>
              ))}
            </select>
          </Field>
          {!assignForm.truck_id ? (
            <>
              <Field label="New truck plate" hint="Creates a truck then assigns it">
                <input
                  value={newTruck.plate_number}
                  onChange={(e) => setNewTruck((f) => ({ ...f, plate_number: e.target.value }))}
                  placeholder="LHR-1001"
                  required
                />
              </Field>
              <Field label="Truck model">
                <input
                  value={newTruck.model}
                  onChange={(e) => setNewTruck((f) => ({ ...f, model: e.target.value }))}
                  placeholder="Hino 300"
                />
              </Field>
              <Field label="Capacity (kg)">
                <input
                  type="number"
                  min={1}
                  value={newTruck.capacity_kg}
                  onChange={(e) => setNewTruck((f) => ({ ...f, capacity_kg: Number(e.target.value) }))}
                />
              </Field>
            </>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Assign truck'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
