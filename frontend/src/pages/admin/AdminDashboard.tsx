import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api/endpoints'
import { extractError } from '../../api/client'
import { FleetMap } from '../../components/FleetMap'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui'
import type { DashboardOverview, LiveMapTruck } from '../../types'
import { formatDate, titleCase } from '../../utils/format'
import { useLiveMapSocket } from '../../utils/useLiveMapSocket'
import { POLL_INTERVALS, usePolling } from '../../utils/usePolling'

export function AdminDashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [wsTrucks, setWsTrucks] = useState<Record<number, LiveMapTruck>>({})
  const [wsStatus, setWsStatus] = useState<string>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [polling, setPolling] = useState(true)
  const lastWsRef = useRef<number>(0)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await adminApi.overview()
      setData(res.data)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // WebSocket live GPS push (primary). REST polling remains as fallback.
  const liveMap = useLiveMapSocket((truck) => {
    lastWsRef.current = Date.now()
    setWsTrucks((prev) => ({
      ...prev,
      [truck.id]: {
        id: truck.id,
        plate_number: truck.plate_number || prev[truck.id]?.plate_number || `Truck ${truck.id}`,
        model: truck.model || prev[truck.id]?.model || '',
        status: truck.status || prev[truck.id]?.status || 'available',
        current_lat: truck.current_lat,
        current_lng: truck.current_lng,
        source: 'websocket',
        updated_at: truck.updated_at || null,
      },
    }))
    setLastUpdated(new Date())
  })
  useEffect(() => {
    setWsStatus(liveMap.status)
  }, [liveMap.status])

  // Slower REST poll as fallback (stats + incidents still need HTTP)
  usePolling(
    () => {
      if (polling) void load({ silent: true })
    },
    POLL_INTERVALS.liveMapMs,
    true,
  )

  if (loading && !data) return <LoadingBlock label="Loading dashboard…" />

  const stats = data?.stats
  const baseTrucks = data?.live_map ?? []
  // Merge WebSocket positions over REST snapshot
  const trucks = baseTrucks.map((t) => {
    const live = wsTrucks[t.id]
    if (live && live.current_lat != null && live.current_lng != null) {
      return { ...t, ...live }
    }
    return t
  })
  for (const live of Object.values(wsTrucks)) {
    if (!baseTrucks.some((t) => t.id === live.id) && live.current_lat != null) {
      trucks.push(live)
    }
  }
  const incidents = data?.recent_incidents ?? []
  const activeVehicles = trucks.filter(
    (t) => t.status === 'in_transit' || t.status === 'available',
  ).length
  const inTransitVehicles = trucks.filter((t) => t.status === 'in_transit').length
  const openIncidents = incidents.filter(
    (i) => i.status === 'reported' || i.status === 'recovery_in_progress',
  ).length
  const activeDeliveries = stats?.in_transit_orders ?? 0
  const totalVehicles = stats?.total_trucks ?? trucks.length
  const liveMode = wsStatus === 'open' ? 'WebSocket' : 'REST poll'
  const liveSource = data?.live_source || (wsStatus === 'open' ? 'websocket' : 'db')

  return (
    <div className="page">
      <PageHeader
        title="Operations Dashboard"
        subtitle={`Fleet, deliveries, and incidents — live via ${liveMode}`}
        actions={
          <>
            <button
              className={`btn ${polling ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPolling((p) => !p)}
              title={polling ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            >
              {polling ? '● Live polling' : '○ Polling paused'}
            </button>
            <button className="btn btn-ghost" onClick={() => void load()}>
              Refresh now
            </button>
            <Link className="btn btn-primary" to="/admin/incidents">
              Incidents
            </Link>
          </>
        }
      />

      <div className="poll-banner">
        <span className={`badge ${wsStatus === 'open' ? 'ok' : 'info'}`}>
          {wsStatus === 'open' ? 'WebSocket live' : 'REST poll'}
        </span>
        <span>
          Live map source: <strong>{liveSource}</strong> · path{' '}
          <code>/admin/dashboard/live-map</code>
          {wsStatus === 'open' ? ' · WS /ws/live-map' : ''}
          {lastUpdated ? ` · last update ${lastUpdated.toLocaleTimeString()}` : ''}
        </span>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Documentation §27 Admin Dashboard metrics */}
      <div className="stat-grid">
        <StatCard label="Total vehicles" value={totalVehicles} />
        <StatCard
          label="Active vehicles"
          value={activeVehicles}
          tone="info"
          hint={`${inTransitVehicles} on trip`}
        />
        <StatCard
          label="Available vehicles"
          value={stats?.available_trucks ?? 0}
          tone="ok"
        />
        <StatCard
          label="Breakdown vehicles"
          value={stats?.breakdown_trucks ?? 0}
          tone="danger"
        />
        <StatCard
          label="Active deliveries"
          value={activeDeliveries}
          tone="info"
          hint={`${stats?.pending_orders ?? 0} pending`}
        />
        <StatCard
          label="Pending orders"
          value={stats?.pending_orders ?? 0}
          tone="warn"
        />
        <StatCard
          label="Open incidents"
          value={openIncidents || stats?.active_incidents || 0}
          tone="danger"
        />
        <StatCard
          label="Pending recovery"
          value={stats?.pending_recovery_requests ?? 0}
          tone="warn"
        />
        <StatCard label="Total drivers" value={stats?.total_drivers ?? 0} />
        <StatCard
          label="Available drivers"
          value={stats?.available_drivers ?? 0}
          tone="ok"
        />
        <StatCard label="Total orders" value={stats?.total_orders ?? 0} />
        <StatCard
          label="Delivered orders"
          value={stats?.delivered_orders ?? 0}
          tone="ok"
        />
        <StatCard label="Parcels" value={stats?.total_parcels ?? 0} />
        <StatCard label="Customers" value={stats?.total_customers ?? 0} />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Live vehicle map</h2>
          <div className="header-meta">
            <span className="muted small">
              Auto-refresh {polling ? `on (${POLL_INTERVALS.liveMapMs / 1000}s)` : 'paused'}
            </span>
            <Link to="/admin/trucks">Manage trucks</Link>
          </div>
        </div>
        <FleetMap trucks={trucks} incidents={incidents} height={440} />
        <p className="muted small map-footnote">
          Coordinates come from truck records (PostgreSQL). Driver GPS streaming and Redis
          pub/sub WebSockets are planned; until then the UI polls REST endpoints.
        </p>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-header">
            <h2>Fleet snapshot</h2>
          </div>
          {trucks.length === 0 ? (
            <EmptyState title="No trucks" description="Create trucks to see them on the map." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plate</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.plate_number}</td>
                      <td>{t.model}</td>
                      <td>
                        <StatusBadge value={t.status} />
                      </td>
                      <td>
                        {t.current_lat != null && t.current_lng != null
                          ? `${t.current_lat.toFixed(4)}, ${t.current_lng.toFixed(4)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Recent incidents</h2>
            <Link to="/admin/incidents">View all</Link>
          </div>
          {incidents.length === 0 ? (
            <EmptyState title="No incidents" description="Breakdowns and emergencies appear here." />
          ) : (
            <ul className="incident-list">
              {incidents.map((i) => (
                <li key={i.id}>
                  <div className="incident-row">
                    <div>
                      <strong>INC-{i.id}</strong> · {titleCase(i.type)}
                      <div className="muted">
                        Truck #{i.truck_id} · Driver #{i.driver_id}
                      </div>
                    </div>
                    <div className="right">
                      <StatusBadge value={i.status} />
                      <div className="muted small">{formatDate(i.created_at)}</div>
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
