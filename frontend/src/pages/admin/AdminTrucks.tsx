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
import type { Truck, TruckStatus } from '../../types'
import { formatDate, formatCoord } from '../../utils/format'

const TRUCK_STATUSES: TruckStatus[] = [
  'available',
  'in_transit',
  'breakdown',
  'maintenance',
  'off_duty',
]

export function AdminTrucks() {
  const [items, setItems] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Truck | null>(null)
  const [form, setForm] = useState({ plate_number: '', model: '', capacity_kg: 5000 })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.listTrucks(statusFilter ? { status: statusFilter } : undefined)
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

  function openCreate() {
    setEditing(null)
    setForm({ plate_number: '', model: '', capacity_kg: 5000 })
    setModalOpen(true)
  }

  function openEdit(truck: Truck) {
    setEditing(truck)
    setForm({
      plate_number: truck.plate_number,
      model: truck.model,
      capacity_kg: truck.capacity_kg,
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
        await adminApi.updateTruck(editing.id, {
          model: form.model,
          capacity_kg: Number(form.capacity_kg),
        })
        setSuccess(`Truck ${form.plate_number} updated`)
      } else {
        await adminApi.createTruck({
          plate_number: form.plate_number,
          model: form.model,
          capacity_kg: Number(form.capacity_kg),
        })
        setSuccess(`Truck ${form.plate_number} created`)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(truck: Truck, status: TruckStatus) {
    setError(null)
    setSuccess(null)
    try {
      await adminApi.updateTruck(truck.id, { status })
      setSuccess(`${truck.plate_number} → ${status}`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  async function remove(truck: Truck) {
    if (!window.confirm(`Delete truck ${truck.plate_number}?`)) return
    try {
      await adminApi.deleteTruck(truck.id)
      setSuccess(`Truck ${truck.plate_number} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Trucks"
        subtitle="Register fleet vehicles here — then assign them to drivers on the Drivers page"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            + Register truck
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {!loading && items.length === 0 ? (
        <div className="panel" style={{ marginBottom: 16, padding: 20 }}>
          <strong>No trucks registered yet</strong>
          <div className="muted small" style={{ marginTop: 6 }}>
            Admin cannot assign a vehicle to a driver until at least one truck exists.
          </div>
          <ol className="muted small" style={{ marginTop: 10, marginLeft: 18 }}>
            <li>Click <strong>+ Register truck</strong> (top right)</li>
            <li>Enter plate number, model, capacity</li>
            <li>Go to <strong>Drivers</strong> → Approve / Assign truck</li>
          </ol>
          <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 12 }}>
            + Register first truck
          </button>
        </div>
      ) : null}

      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {TRUCK_STATUSES.map((s) => (
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
                  <th>Plate</th>
                  <th>Model</th>
                  <th>Capacity</th>
                  <th>Load</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.plate_number}</td>
                    <td>{t.model}</td>
                    <td>{t.capacity_kg} kg</td>
                    <td>{t.current_load_kg} kg</td>
                    <td>
                      <StatusBadge value={t.status} />
                      <select
                        className="status-select"
                        value={t.status}
                        onChange={(e) => changeStatus(t, e.target.value as TruckStatus)}
                      >
                        {TRUCK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{formatCoord(t.current_lat, t.current_lng)}</td>
                    <td>{formatDate(t.updated_at)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => openEdit(t)}>
                        Edit
                      </button>
                      <button className="btn btn-sm danger" onClick={() => remove(t)}>
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
        title={editing ? `Edit truck #${editing.id}` : 'Register truck'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="stack">
          <Field label="Plate number" hint="Must be unique (e.g. LHR-1001)">
            <input
              value={form.plate_number}
              onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))}
              required
              disabled={!!editing}
              placeholder="LHR-1001"
            />
          </Field>
          <Field label="Model">
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              required
              placeholder="Hino 300"
            />
          </Field>
          <Field label="Capacity (kg)">
            <input
              type="number"
              min={1}
              value={form.capacity_kg}
              onChange={(e) => setForm((f) => ({ ...f, capacity_kg: Number(e.target.value) }))}
              required
            />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Register truck'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
