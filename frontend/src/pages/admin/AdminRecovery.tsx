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
import type { RecoveryRequest } from '../../types'
import { formatDate, titleCase } from '../../utils/format'

export function AdminRecovery() {
  const [requests, setRequests] = useState<RecoveryRequest[]>([])
  const [responses, setResponses] = useState<
    { id: number; recovery_request_id: number; driver_id: number; status: string; responded_at: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<RecoveryRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [r, resp] = await Promise.all([
        adminApi.listRecoveryRequests(statusFilter ? { status: statusFilter } : undefined),
        adminApi.listRecoveryResponses(),
      ])
      setRequests(r.data)
      setResponses(resp.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  return (
    <div className="page">
      <PageHeader
        title="Recovery Operations"
        subtitle="AI-assisted vehicle breakdown recovery requests and driver responses"
        actions={
          <button className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <div className="toolbar">
        <label className="field inline">
          <span className="field-label">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="accepted">accepted</option>
            <option value="rejected">rejected</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-header">
            <h2>Recovery requests</h2>
          </div>
          {loading ? (
            <LoadingBlock />
          ) : requests.length === 0 ? (
            <p className="muted">No recovery requests yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Incident</th>
                    <th>Source</th>
                    <th>Target</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Distance</th>
                    <th>Free space</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>#{r.incident_id}</td>
                      <td>#{r.source_truck_id}</td>
                      <td>#{r.target_truck_id}</td>
                      <td>#{r.target_driver_id}</td>
                      <td>
                        <StatusBadge value={r.status} />
                      </td>
                      <td>{r.distance_km != null ? `${r.distance_km} km` : '—'}</td>
                      <td>{r.free_space_kg != null ? `${r.free_space_kg} kg` : '—'}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setSelected(r)}>
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Driver responses</h2>
          </div>
          {responses.length === 0 ? (
            <p className="muted">No driver responses yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Responded</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.recovery_request_id}</td>
                      <td>#{r.driver_id}</td>
                      <td>
                        <StatusBadge value={r.status} />
                      </td>
                      <td>{formatDate(r.responded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!selected}
        title={`Recovery request #${selected?.id ?? ''}`}
        onClose={() => setSelected(null)}
        wide
      >
        {selected ? (
          <div className="detail-grid">
            <div>
              <span className="field-label">Status</span>
              <StatusBadge value={selected.status} />
            </div>
            <div>
              <span className="field-label">Incident</span>
              <div>#{selected.incident_id}</div>
            </div>
            <div>
              <span className="field-label">Source truck</span>
              <div>#{selected.source_truck_id}</div>
            </div>
            <div>
              <span className="field-label">Target truck</span>
              <div>#{selected.target_truck_id}</div>
            </div>
            <div>
              <span className="field-label">Target driver</span>
              <div>#{selected.target_driver_id}</div>
            </div>
            <div>
              <span className="field-label">Distance</span>
              <div>{selected.distance_km != null ? `${selected.distance_km} km` : '—'}</div>
            </div>
            <div>
              <span className="field-label">Free capacity</span>
              <div>{selected.free_space_kg != null ? `${selected.free_space_kg} kg` : '—'}</div>
            </div>
            <div>
              <span className="field-label">Created</span>
              <div>{formatDate(selected.created_at)}</div>
            </div>
            <div className="full-span">
              <span className="field-label">AI reasoning</span>
              <p className="ai-reasoning">{selected.ai_reasoning || 'No AI reasoning recorded.'}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
