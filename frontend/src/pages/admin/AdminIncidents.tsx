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
import type { Incident, IncidentStatus, IncidentType } from '../../types'
import { formatDate, formatCoord, titleCase } from '../../utils/format'

const TYPES: IncidentType[] = ['breakdown', 'accident', 'flat_tire', 'engine_failure', 'other']
const STATUSES: IncidentStatus[] = ['reported', 'recovery_in_progress', 'resolved', 'closed']

export function AdminIncidents() {
  const [items, setItems] = useState<Incident[]>([])
  const [trucks, setTrucks] = useState<{ id: number; plate_number: string }[]>([])
  const [drivers, setDrivers] = useState<{ id: number; license_number: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [resolveTarget, setResolveTarget] = useState<Incident | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    truck_id: '',
    driver_id: '',
    type: 'breakdown' as IncidentType,
    description: '',
    lat: 31.5204,
    lng: 74.3587,
  })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [inc, t, d] = await Promise.all([
        adminApi.listIncidents(statusFilter ? { status: statusFilter } : undefined),
        adminApi.listTrucks(),
        adminApi.listDrivers(),
      ])
      setItems(inc.data)
      setTrucks(t.data)
      setDrivers(d.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  async function createIncident(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await adminApi.createIncident({
        truck_id: Number(form.truck_id),
        driver_id: Number(form.driver_id),
        type: form.type,
        description: form.description || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
      })
      setSuccess('Incident created')
      setModalOpen(false)
      setForm({
        truck_id: '',
        driver_id: '',
        type: 'breakdown',
        description: '',
        lat: 31.5204,
        lng: 74.3587,
      })
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function resolve(incident: Incident, status: IncidentStatus) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await adminApi.resolveIncident(incident.id, status)
      setSuccess(`Incident #${incident.id} → ${status}`)
      setResolveTarget(null)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(incident: Incident) {
    if (!window.confirm(`Delete incident #${incident.id}?`)) return
    try {
      await adminApi.deleteIncident(incident.id)
      setSuccess(`Incident #${incident.id} deleted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Incidents"
        subtitle="Breakdowns, accidents, and recovery progress"
        actions={
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            + Report incident
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => (
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
                  <th>Type</th>
                  <th>Truck</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>#{i.id}</td>
                    <td>{titleCase(i.type)}</td>
                    <td>
                      {trucks.find((t) => t.id === i.truck_id)?.plate_number || `#${i.truck_id}`}
                    </td>
                    <td>{`#${i.driver_id}`}</td>
                    <td>
                      <StatusBadge value={i.status} />
                    </td>
                    <td>{formatCoord(i.lat, i.lng)}</td>
                    <td className="truncate">{i.description || '—'}</td>
                    <td>{formatDate(i.created_at)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => setResolveTarget(i)}>
                        Resolve
                      </button>
                      <button className="btn btn-sm danger" onClick={() => remove(i)}>
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

      <Modal open={modalOpen} title="Report incident" onClose={() => setModalOpen(false)}>
        <form onSubmit={createIncident} className="stack">
          <Field label="Truck">
            <select
              value={form.truck_id}
              onChange={(e) => setForm((f) => ({ ...f, truck_id: e.target.value }))}
              required
            >
              <option value="">Select truck…</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.plate_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Driver">
            <select
              value={form.driver_id}
              onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
              required
            >
              <option value="">Select driver…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} — {d.license_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IncidentType }))}
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
          <Field label="Latitude">
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm((f) => ({ ...f, lat: Number(e.target.value) }))}
              required
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm((f) => ({ ...f, lng: Number(e.target.value) }))}
              required
            />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Create incident'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resolveTarget}
        title={`Resolve incident #${resolveTarget?.id ?? ''}`}
        onClose={() => setResolveTarget(null)}
      >
        <div className="stack">
          <p>Set the incident status to:</p>
          <div className="status-actions">
            {STATUSES.filter((s) => s !== resolveTarget?.status).map((s) => (
              <button
                key={s}
                className="btn btn-primary"
                disabled={busy}
                onClick={() => resolveTarget && resolve(resolveTarget, s)}
              >
                Mark {titleCase(s)}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
