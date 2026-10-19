import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { driverApi } from '../../api/endpoints'
import { extractError } from '../../api/client'
import {
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  SuccessBanner,
} from '../../components/ui'
import type {
  DriverProfile,
  Incident,
  IncidentType,
  Notification,
  Order,
  RecoveryRequest,
  Truck,
} from '../../types'
import { formatDate, formatCoord, titleCase } from '../../utils/format'
import { useGeolocation } from '../../utils/useGeolocation'
import { POLL_INTERVALS, usePolling } from '../../utils/usePolling'
import { RoutePanel } from '../../components/RoutePanel'
import { useDriverLocationStream } from '../../utils/useDriverLocationStream'
import { useDriverProximitySocket, type StuckTruckAlert } from '../../utils/useDriverProximitySocket'

const INCIDENT_TYPES: IncidentType[] = [
  'breakdown',
  'accident',
  'flat_tire',
  'engine_failure',
  'other',
]

const DRIVER_STATUSES = ['available', 'on_delivery', 'on_leave', 'suspended'] as const
const JOURNEY_STATUSES = ['assigned', 'in_transit', 'delivered'] as const

export function DriverDashboard() {
  const [profile, setProfile] = useState<DriverProfile | null>(null)
  const [truck, setTruck] = useState<Truck | null>(null)
  const [deliveries, setDeliveries] = useState<Order[]>([])
  const [incoming, setIncoming] = useState<Order[]>([])
  const [recovery, setRecovery] = useState<RecoveryRequest[]>([])
  const [incidents, setIncidents] = useState<
    Awaited<ReturnType<typeof driverApi.listIncidents>>['data']
  >([])
  const [fleetIncidents, setFleetIncidents] = useState<Incident[]>([])
  const [notices, setNotices] = useState<Notification[]>([])
  const [nearbyStuck, setNearbyStuck] = useState<StuckTruckAlert[]>([])
  const [wsStatus, setWsStatus] = useState<string>('connecting')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    type: 'breakdown' as IncidentType,
    description: '',
    lat: '',
    lng: '',
  })
  const [busy, setBusy] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [locationLive, setLocationLive] = useState(false)
  const [lastGps, setLastGps] = useState<{ lat: number; lng: number } | null>(null)
  const geo = useGeolocation()

  // Stream GPS while journey is active (truck status in_transit)
  useDriverLocationStream({
    enabled: locationLive && !!truck?.id,
    truckId: truck?.id ?? null,
    status: 'in_transit',
    onSent: (loc) => setLastGps(loc),
    onError: (msg) => setError(msg),
  })

  // Real-time nearby stuck-truck alerts (WebSocket 10km radius)
  const proximity = useDriverProximitySocket((alert) => {
    setNearbyStuck((prev) => {
      const key = alert.incident_id
      if (prev.some((p) => p.incident_id === key)) return prev
      return [alert, ...prev].slice(0, 20)
    })
  })
  useEffect(() => {
    setWsStatus(proximity.status)
  }, [proximity.status])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const [p, d, incOrders, r, inc, fleet, notes, nearby] = await Promise.all([
        driverApi.profile(),
        driverApi.listDeliveries(),
        driverApi.listIncomingOrders().catch(() => ({ data: [] as Order[] })),
        driverApi.listRecoveryRequests(),
        driverApi.listIncidents(),
        driverApi.listFleetIncidents().catch(() => ({ data: [] as Incident[] })),
        driverApi.listNotifications({ unread_only: true }).catch(() => ({ data: [] as Notification[] })),
        driverApi.listNearbyTrucks(10).catch(() => ({
          data: [] as {
            truck_id: number
            plate_number: string
            model: string
            status: string
            lat: number
            lng: number
            distance_km: number
          }[],
        })),
      ])
      setProfile(p.data)
      setDeliveries(d.data)
      setIncoming(incOrders.data)
      setRecovery(r.data)
      setIncidents(inc.data)
      setFleetIncidents(fleet.data)
      setNotices(notes.data)
      // Merge REST nearby stuck trucks into live list
      const stuckFromRest = nearby.data
        .filter((t) => t.status === 'breakdown' || t.status === 'reported')
        .map((t) => ({
          incident_id: 0,
          radius_km: 10,
          stuck_truck: {
            truck_id: t.truck_id,
            plate_number: t.plate_number,
            model: t.model,
            lat: t.lat,
            lng: t.lng,
            incident_type: 'nearby',
            description: `${t.distance_km} km away · ${t.status}`,
          },
          nearby_trucks: [t],
          message: `Nearby truck ${t.plate_number} is ${t.status} (~${t.distance_km} km)`,
        }))
      setNearbyStuck((prev) => {
        const ids = new Set(prev.map((a) => a.stuck_truck.truck_id))
        const extra = stuckFromRest.filter((a) => !ids.has(a.stuck_truck.truck_id))
        return [...extra, ...prev].slice(0, 20)
      })
      setLastUpdated(new Date())
      setError(null)
      if (p.data.truck_id) {
        try {
          const t = await driverApi.getTruck(p.data.truck_id)
          setTruck(t.data)
          setLocationLive(t.data.status === 'in_transit')
        } catch {
          setTruck(null)
        }
      } else {
        setTruck(null)
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

  // REST polling — emergency recovery requests arrive without WebSockets yet
  usePolling(() => void load({ silent: true }), POLL_INTERVALS.driverOpsMs)

  function fillLocationFromTruck() {
    if (!truck?.current_lat || !truck?.current_lng) {
      setError('Truck has no stored coordinates — use browser geolocation instead')
      return
    }
    setIncidentForm((f) => ({
      ...f,
      lat: String(truck.current_lat),
      lng: String(truck.current_lng),
    }))
  }

  async function acceptOrder(orderId: number) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.acceptOrder(orderId)
      setSuccess(`Order #${orderId} accepted — it is now on your deliveries`)
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function rejectOrder(orderId: number) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.rejectOrder(orderId)
      setSuccess(`Order #${orderId} rejected — offered to another driver if available`)
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function setDriverStatus(status: string) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.updateStatus(status)
      setSuccess(`Driver status → ${status}`)
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function setTruckStatus(status: string) {
    if (!truck) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await driverApi.updateTruckStatus(truck.id, status)
      setTruck(res.data)
      if (status === 'in_transit') {
        setLocationLive(true)
        setSuccess(
          `Journey started — streaming GPS. Customers can see your location on the order map.`,
        )
      } else if (status === 'available') {
        setLocationLive(false)
        setSuccess(`Journey paused — truck stopped. Customers see “Driver stopped / paused”.`)
      } else if (status === 'breakdown') {
        setLocationLive(false)
        setSuccess(`Truck marked breakdown — location streaming stopped.`)
      } else {
        setSuccess(`Truck ${truck.plate_number} → ${status}`)
      }
      if (status === 'breakdown' && truck.current_lat && truck.current_lng) {
        setIncidentForm((f) => ({
          ...f,
          lat: String(truck.current_lat),
          lng: String(truck.current_lng),
        }))
      }
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function startJourney() {
    if (!truck) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      // 1) Start GPS streaming first so location is live immediately
      setLocationLive(true)
      // 2) Mark truck on trip
      const res = await driverApi.updateTruckStatus(truck.id, 'in_transit')
      setTruck(res.data)
      // 3) Move accepted/active orders to in_transit
      const active = deliveries.filter(
        (d) => d.status === 'assigned' || d.status === 'pending',
      )
      for (const d of active) {
        if (d.status === 'assigned') {
          try {
            await driverApi.updateDeliveryStatus(d.id, { status: 'in_transit' })
          } catch {
            /* ignore single order failures */
          }
        }
      }
      setSuccess(
        'START — journey active. GPS streaming to backend. Customer order map will show “Driver on the way”.',
      )
      await load({ silent: true })
    } catch (err) {
      setLocationLive(false)
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function pauseJourney() {
    if (!truck) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      setLocationLive(false)
      const res = await driverApi.updateTruckStatus(truck.id, 'available')
      setTruck(res.data)
      setSuccess(
        'PAUSE — truck stopped. Customer map shows “Driver stopped / paused” at last GPS point.',
      )
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function setDeliveryStatus(orderId: number, status: string) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.updateDeliveryStatus(orderId, { status })
      setSuccess(`Order #${orderId} → ${status}`)
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function fillLocation() {
    try {
      const loc = await geo.request()
      setIncidentForm((f) => ({ ...f, lat: String(loc.lat), lng: String(loc.lng) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location failed')
    }
  }

  async function submitIncident(e: FormEvent) {
    e.preventDefault()
    if (!incidentForm.lat || !incidentForm.lng) {
      setError('Latitude and longitude are required (use truck location or current location)')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.reportIncident({
        type: incidentForm.type,
        description: incidentForm.description || null,
        lat: Number(incidentForm.lat),
        lng: Number(incidentForm.lng),
      })
      setSuccess('Incident reported — truck status set to breakdown')
      setIncidentOpen(false)
      setIncidentForm({ type: 'breakdown', description: '', lat: '', lng: '' })
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function acceptRecovery(id: number) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.acceptRecovery(id)
      setSuccess(`Recovery request #${id} accepted`)
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function rejectRecovery(id: number) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.rejectRecovery(id)
      setSuccess(`Recovery request #${id} rejected`)
      await load({ silent: true })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading && !profile) return <LoadingBlock label="Loading driver dashboard…" />

  const pendingRecovery = recovery.filter((r) => r.status === 'pending')
  const incomingOrders = incoming.filter((o) => o.status === 'pending')
  const activeDeliveries = deliveries.filter(
    (d) => d.status === 'assigned' || d.status === 'in_transit',
  )
  const primaryRoute =
    activeDeliveries.find((d) => d.status === 'in_transit') || activeDeliveries[0] || deliveries[0] || null
  const openIncidents = incidents.filter(
    (i) => i.status === 'reported' || i.status === 'recovery_in_progress',
  )
  const openFleetIncidents = fleetIncidents.filter(
    (i) => i.status === 'reported' || i.status === 'recovery_in_progress',
  )
  const incidentNotices = notices.filter((n) => n.type === 'incident_alert')
  const unreadNotices =
    pendingRecovery.length +
    openIncidents.length +
    openFleetIncidents.length +
    incidentNotices.length +
    nearbyStuck.length +
    incomingOrders.length

  async function markNoticeRead(id: number) {
    try {
      await driverApi.markNotificationRead(id)
      setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Driver Dashboard"
        subtitle="Incoming orders (Accept/Reject), route, journey control, and recovery assist"
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => void load()}>
              Refresh
            </button>
            <button className="btn btn-danger" onClick={() => setIncidentOpen(true)}>
              Report incident
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {/* Fleet-wide + nearby stuck alerts via WebSocket */}
      {(openFleetIncidents.length > 0 || incidentNotices.length > 0 || nearbyStuck.length > 0) && (
        <section className="panel" style={{ borderColor: '#ef4444' }}>
          <div className="panel-header">
            <h2>
              Fleet / nearby alerts
              <span className="badge danger" style={{ marginLeft: 8 }}>
                {openFleetIncidents.length + incidentNotices.length + nearbyStuck.length}
              </span>
            </h2>
            <span className={`badge ${wsStatus === 'open' ? 'ok' : 'info'}`}>
              WS {wsStatus === 'open' ? 'live' : wsStatus} · 10 km radius
            </span>
          </div>
          <p className="muted small">
            When a truck is stuck, all trucks within <strong>10 km</strong> get a real-time
            WebSocket alert. Fleet messages also appear for every driver.
          </p>

          {nearbyStuck.length > 0 && (
            <>
              <h3 style={{ marginTop: 8 }}>Nearby stuck trucks (≤10 km)</h3>
              <ul className="incident-list" style={{ marginBottom: 12 }}>
                {nearbyStuck.map((a, idx) => (
                  <li key={`near-${a.incident_id}-${a.stuck_truck.truck_id}-${idx}`}>
                    <div className="incident-row">
                      <div>
                        <strong>
                          {a.stuck_truck.plate_number} · Truck #{a.stuck_truck.truck_id}
                        </strong>
                        <div className="muted">
                          {a.message}
                          {a.stuck_truck.lat != null
                            ? ` · (${a.stuck_truck.lat.toFixed(4)}, ${a.stuck_truck.lng.toFixed(4)})`
                            : ''}
                        </div>
                        {a.nearby_trucks?.[0]?.distance_km != null && (
                          <div className="muted small">
                            Distance ~{a.nearby_trucks[0].distance_km} km · radius{' '}
                            {a.radius_km} km
                          </div>
                        )}
                      </div>
                      <span className="badge danger">Stuck nearby</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {incidentNotices.length > 0 && (
            <ul className="incident-list" style={{ marginBottom: 12 }}>
              {incidentNotices.map((n) => (
                <li key={`n-${n.id}`}>
                  <div className="incident-row">
                    <div>
                      <strong>{n.title}</strong>
                      <div className="muted">{n.message}</div>
                      <div className="muted small">{formatDate(n.created_at)}</div>
                    </div>
                    {!n.is_read ? (
                      <button className="btn btn-sm" onClick={() => markNoticeRead(n.id)}>
                        Mark read
                      </button>
                    ) : (
                      <span className="badge ok">Read</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {openFleetIncidents.length > 0 && (
            <ul className="incident-list">
              {openFleetIncidents.map((i) => (
                <li key={`fleet-${i.id}`}>
                  <div className="incident-row">
                    <div>
                      <strong>Fleet INC-{i.id}</strong> · Truck #{i.truck_id} ·{' '}
                      {titleCase(i.type)}
                      <div className="muted">
                        {i.description || '—'} · {formatCoord(i.lat, i.lng)} ·{' '}
                        {formatDate(i.created_at)}
                      </div>
                    </div>
                    <StatusBadge value={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="poll-banner">
        <span className="badge info">REST poll + WebSocket</span>
        <span>
          Incoming orders & recovery auto-refresh every {POLL_INTERVALS.driverOpsMs / 1000}s
          {lastUpdated ? ` · last update ${lastUpdated.toLocaleTimeString()}` : ''} ·
          Nearby stuck trucks push via <code>/ws/driver</code> · Accept/Reject orders below
        </span>
      </div>

      {/* Docs: customer order → driver sees it → Accept / Reject */}
      <section className="panel">
        <div className="panel-header">
          <h2>
            Incoming orders
            {incomingOrders.length > 0 ? (
              <span className="badge danger" style={{ marginLeft: 8 }}>
                {incomingOrders.length} to review
              </span>
            ) : null}
          </h2>
          <Link to="/driver/deliveries">All deliveries</Link>
        </div>
        {incomingOrders.length === 0 ? (
          <p className="muted">
            No new customer orders waiting for you right now. New orders appear here with
            <strong> Accept</strong> / <strong>Reject</strong> buttons.
          </p>
        ) : (
          <div className="recovery-grid">
            {incomingOrders.map((o) => (
              <div key={o.id} className="recovery-card">
                <div className="recovery-card-header">
                  <strong>New order #{o.id}</strong>
                  <StatusBadge value={o.status} />
                </div>
                <div className="detail-grid compact">
                  <div>
                    <span className="field-label">Customer</span>
                    <div>#{o.customer_id}</div>
                  </div>
                  <div>
                    <span className="field-label">Pickup</span>
                    <div>
                      {o.pickup_address || formatCoord(o.pickup_lat, o.pickup_lng)}
                    </div>
                  </div>
                  <div>
                    <span className="field-label">Delivery</span>
                    <div>
                      {o.delivery_address || formatCoord(o.delivery_lat, o.delivery_lng)}
                    </div>
                  </div>
                  <div>
                    <span className="field-label">Deadline</span>
                    <div>{formatDate(o.deadline)}</div>
                  </div>
                  <div>
                    <span className="field-label">Created</span>
                    <div>{formatDate(o.created_at)}</div>
                  </div>
                </div>
                <div className="status-actions">
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => acceptOrder(o.id)}
                  >
                    Accept order
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => rejectOrder(o.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingRecovery.length > 0 ? (
        <div className="emergency-card">
          <div className="emergency-title">EMERGENCY RECOVERY REQUEST</div>
          <p>
            {pendingRecovery.length} recovery request(s) assigned to you. Accept to assist with
            parcel transfer, or reject so operations can select the next candidate.
          </p>
          <div className="status-actions">
            {pendingRecovery.map((r) => (
              <div key={r.id} className="recovery-chip">
                <div>
                  <strong>Request #{r.id}</strong> · Incident #{r.incident_id} · Broken truck #
                  {r.source_truck_id}
                  {r.distance_km != null ? ` · ${r.distance_km} km` : ''}
                  {r.free_space_kg != null ? ` · ${r.free_space_kg} kg free capacity` : ''}
                </div>
                <div className="muted small">
                  Target vehicle #{r.target_truck_id} · {formatDate(r.created_at)}
                </div>
                <div className="actions">
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => acceptRecovery(r.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => rejectRecovery(r.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Docs §6 Driver Dashboard hero */}
      <div className="driver-hero">
        <div className="driver-hero-main">
          <div className="avatar lg">{profile?.user.full_name.charAt(0) || 'D'}</div>
          <div>
            <h2>Driver: {profile?.user.full_name}</h2>
            <p className="muted">
              Driver #{profile?.id} · {profile?.license_number} · {profile?.user.email}
            </p>
            <div className="chip-row">
              <span className="badge info">
                Status: {titleCase(truck?.status === 'in_transit' ? 'on trip' : profile?.status)}
              </span>
              {truck ? (
                <span className="badge muted">
                  Vehicle: {truck.plate_number} ({truck.model})
                </span>
              ) : (
                <span className="badge warn">No vehicle assigned</span>
              )}
              {unreadNotices > 0 ? (
                <span className="badge danger">{unreadNotices} alert(s)</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="driver-hero-side">
          <div>
            <span className="field-label">Driver status</span>
            <select
              value={profile?.status || 'available'}
              disabled={busy}
              onChange={(e) => setDriverStatus(e.target.value)}
            >
              {DRIVER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="field-label">Truck status (journey)</span>
            <select
              value={truck?.status || 'available'}
              disabled={!truck || busy}
              onChange={(e) => setTruckStatus(e.target.value)}
            >
              <option value="available">available (ready / idle)</option>
              <option value="in_transit">in_transit (on trip)</option>
              <option value="breakdown">breakdown</option>
              <option value="off_duty">off_duty</option>
            </select>
          </div>
          <div className="journey-actions">
            <button
              className="btn btn-primary"
              disabled={!truck || busy}
              onClick={() => void startJourney()}
            >
              START
            </button>
            <button
              className="btn btn-warn"
              disabled={!truck || busy || !locationLive}
              onClick={() => void pauseJourney()}
            >
              PAUSE
            </button>
            <button className="btn btn-danger" onClick={() => setIncidentOpen(true)}>
              INCIDENT
            </button>
          </div>
          <div className={`poll-banner ${locationLive ? 'live-gps' : ''}`}>
            <span className={`badge ${locationLive ? 'ok' : 'muted'}`}>
              {locationLive ? '● GPS live' : '○ GPS off'}
            </span>
            <span>
              {locationLive
                ? `Streaming location every 5s. Last: ${
                    lastGps
                      ? `${lastGps.lat.toFixed(5)}, ${lastGps.lng.toFixed(5)}`
                      : formatCoord(truck?.current_lat, truck?.current_lng)
                  } · Customer sees map after START`
                : 'Tap START to stream GPS so customers can track you on the order map'}
            </span>
          </div>
        </div>
      </div>

      <RoutePanel
        order={primaryRoute}
        vehicleLocation={truck ? { lat: truck.current_lat, lng: truck.current_lng } : null}
        vehicleLabel={truck ? `${truck.plate_number} · ${truck.model}` : '—'}
      />

      <div className="stat-grid">
        <StatCard label="Assigned truck" value={truck ? truck.plate_number : '—'} />
        <StatCard label="Truck model" value={truck?.model || '—'} />
        <StatCard label="Capacity" value={truck ? `${truck.capacity_kg} kg` : '—'} />
        <StatCard label="Current load" value={truck ? `${truck.current_load_kg} kg` : '—'} tone="info" />
        <StatCard
          label="Available capacity"
          value={
            truck
              ? `${Math.max(0, truck.capacity_kg - truck.current_load_kg)} kg`
              : '—'
          }
          tone="ok"
        />
        <StatCard
          label="Current location"
          value={formatCoord(truck?.current_lat, truck?.current_lng)}
        />
        <StatCard label="Active deliveries" value={activeDeliveries.length} tone="info" />
        <StatCard
          label="Incoming offers"
          value={incomingOrders.length}
          tone="danger"
          hint="Accept / Reject"
        />
        <StatCard label="Open incidents" value={openIncidents.length} tone="warn" />
        <StatCard label="Pending recovery" value={pendingRecovery.length} tone="danger" />
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-header">
            <h2>Accepted deliveries</h2>
            <Link to="/driver/deliveries">View all</Link>
          </div>
          {activeDeliveries.length === 0 ? (
            <EmptyState
              title="No accepted deliveries"
              description="Accept an incoming order above to start a delivery."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Pickup</th>
                    <th>Delivery</th>
                    <th>Deadline</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDeliveries.map((d) => (
                    <tr key={d.id}>
                      <td>#{d.id}</td>
                      <td>
                        <StatusBadge value={d.status} />
                      </td>
                      <td>{d.pickup_address || formatCoord(d.pickup_lat, d.pickup_lng)}</td>
                      <td>{d.delivery_address || formatCoord(d.delivery_lat, d.delivery_lng)}</td>
                      <td>{formatDate(d.deadline)}</td>
                      <td>
                        <select
                          value={d.status}
                          disabled={busy}
                          onChange={(e) => setDeliveryStatus(d.id, e.target.value)}
                        >
                          {JOURNEY_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>Notifications & recovery</h2>
              <Link to="/driver/recovery">Open recovery</Link>
            </div>
            {unreadNotices === 0 ? (
              <p className="muted">No pending recovery or open incidents.</p>
            ) : (
              <ul className="incident-list">
                {pendingRecovery.map((r) => (
                  <li key={`n-${r.id}`}>
                    <div className="incident-row">
                      <div>
                        <strong>Recovery #{r.id}</strong>
                        <div className="muted">
                          Assist truck #{r.source_truck_id} · Incident #{r.incident_id}
                          {r.ai_reasoning ? ` · ${r.ai_reasoning}` : ''}
                        </div>
                      </div>
                      <div className="right">
                        <StatusBadge value={r.status} />
                        <div className="actions" style={{ marginTop: 6 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy}
                            onClick={() => acceptRecovery(r.id)}
                          >
                            Accept
                          </button>
                          <button
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => rejectRecovery(r.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {openIncidents.map((i) => (
                  <li key={`i-${i.id}`}>
                    <div className="incident-row">
                      <div>
                        <strong>INC-{i.id}</strong> · {titleCase(i.type)}
                        <div className="muted">
                          {i.description || '—'} · {formatCoord(i.lat, i.lng)}
                        </div>
                      </div>
                      <StatusBadge value={i.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>My incidents</h2>
              <Link to="/driver/incidents">History</Link>
            </div>
            <DriverIncidentsPanel items={incidents} />
          </section>
        </div>
      </div>

      <Modal
        open={incidentOpen}
        title="Report vehicle incident"
        onClose={() => setIncidentOpen(false)}
      >
        <form onSubmit={submitIncident} className="stack">
          <Field label="Incident type">
            <select
              value={incidentForm.type}
              onChange={(e) =>
                setIncidentForm((f) => ({ ...f, type: e.target.value as IncidentType }))
              }
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description" hint="Engine failure, flat tire, accident details…">
            <textarea
              value={incidentForm.description}
              onChange={(e) => setIncidentForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </Field>
          <div className="location-row">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={incidentForm.lat}
                onChange={(e) => setIncidentForm((f) => ({ ...f, lat: e.target.value }))}
                required
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={incidentForm.lng}
                onChange={(e) => setIncidentForm((f) => ({ ...f, lng: e.target.value }))}
                required
              />
            </Field>
          </div>
          <div className="status-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={fillLocationFromTruck}
              disabled={!truck?.current_lat}
            >
              Use truck coordinates
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={fillLocation}
              disabled={geo.loading}
            >
              {geo.loading ? 'Locating…' : 'Use browser geolocation'}
            </button>
          </div>
          {geo.error ? <div className="error-banner">{geo.error}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIncidentOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" disabled={busy}>
              {busy ? 'Reporting…' : 'Submit incident'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function DriverIncidentsPanel({
  items,
}: {
  items: Awaited<ReturnType<typeof driverApi.listIncidents>>['data']
}) {
  if (!items.length) return <p className="muted">No incidents reported yet.</p>

  return (
    <ul className="incident-list">
      {items.map((i) => (
        <li key={i.id}>
          <div className="incident-row">
            <div>
              <strong>INC-{i.id}</strong> · {titleCase(i.type)}
              <div className="muted">
                {i.description || 'No description'} · {formatCoord(i.lat, i.lng)}
              </div>
              <div className="muted small">{formatDate(i.created_at)}</div>
            </div>
            <StatusBadge value={i.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DriverDeliveries() {
  const [items, setItems] = useState<Order[]>([])
  const [incoming, setIncoming] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [d, inc] = await Promise.all([
        driverApi.listDeliveries(),
        driverApi.listIncomingOrders().catch(() => ({ data: [] as Order[] })),
      ])
      setItems(d.data)
      setIncoming(inc.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function accept(orderId: number) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.acceptOrder(orderId)
      setSuccess(`Order #${orderId} accepted`)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function reject(orderId: number) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.rejectOrder(orderId)
      setSuccess(`Order #${orderId} rejected`)
      await load()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(orderId: number, status: string) {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.updateDeliveryStatus(orderId, { status })
      setSuccess(`Order #${orderId} → ${status}`)
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
        title="My Deliveries"
        subtitle="Incoming offers (Accept/Reject) and accepted jobs"
        actions={
          <button className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <section className="panel">
        <div className="panel-header">
          <h2>Incoming orders</h2>
        </div>
        {incoming.filter((o) => o.status === 'pending').length === 0 ? (
          <p className="muted">No incoming offers.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Pickup</th>
                  <th>Delivery</th>
                  <th>Deadline</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {incoming
                  .filter((o) => o.status === 'pending')
                  .map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>
                        <StatusBadge value={o.status} />
                      </td>
                      <td>{o.pickup_address || formatCoord(o.pickup_lat, o.pickup_lng)}</td>
                      <td>{o.delivery_address || formatCoord(o.delivery_lat, o.delivery_lng)}</td>
                      <td>{formatDate(o.deadline)}</td>
                      <td className="actions">
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={busy}
                          onClick={() => accept(o.id)}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-sm danger"
                          disabled={busy}
                          onClick={() => reject(o.id)}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Deadline</th>
                <th>Update status</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter((o) => o.status !== 'pending')
                .map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>
                      <StatusBadge value={o.status} />
                    </td>
                    <td>{o.pickup_address || formatCoord(o.pickup_lat, o.pickup_lng)}</td>
                    <td>{o.delivery_address || formatCoord(o.delivery_lat, o.delivery_lng)}</td>
                    <td>{formatDate(o.deadline)}</td>
                    <td>
                      <select
                        value={o.status}
                        disabled={busy || o.status === 'pending'}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                      >
                        {['assigned', 'in_transit', 'delivered'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function DriverIncidents() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof driverApi.listIncidents>>['data']
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'breakdown' as IncidentType,
    description: '',
    lat: '',
    lng: '',
  })
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const geo = useGeolocation()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await driverApi.listIncidents()
      setItems(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function fillLocation() {
    try {
      const loc = await geo.request()
      setForm((f) => ({ ...f, lat: String(loc.lat), lng: String(loc.lng) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location failed')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await driverApi.reportIncident({
        type: form.type,
        description: form.description || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
      })
      setSuccess('Incident reported')
      setIncidentOpen(false)
      setForm({ type: 'breakdown', description: '', lat: '', lng: '' })
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
        title="My Incidents"
        subtitle="Breakdowns and emergencies you have reported"
        actions={
          <button className="btn btn-danger" onClick={() => setIncidentOpen(true)}>
            + Report incident
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
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>#{i.id}</td>
                    <td>{titleCase(i.type)}</td>
                    <td>
                      <StatusBadge value={i.status} />
                    </td>
                    <td>{formatCoord(i.lat, i.lng)}</td>
                    <td className="truncate">{i.description || '—'}</td>
                    <td>{formatDate(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={incidentOpen} title="Report incident" onClose={() => setIncidentOpen(false)}>
        <form onSubmit={submit} className="stack">
          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IncidentType }))}
            >
              {INCIDENT_TYPES.map((t) => (
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
          <div className="location-row">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                required
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                required
              />
            </Field>
          </div>
          <button type="button" className="btn btn-ghost" onClick={fillLocation}>
            Use current location
          </button>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIncidentOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" disabled={busy}>
              Submit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export function DriverRecovery() {
  const [items, setItems] = useState<RecoveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await driverApi.listRecoveryRequests()
      setItems(res.data)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function act(id: number, action: 'accept' | 'reject') {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (action === 'accept') await driverApi.acceptRecovery(id)
      else await driverApi.rejectRecovery(id)
      setSuccess(`Request #${id} ${action}ed`)
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
        title="Recovery Requests"
        subtitle="Assist vehicles that broke down nearby"
        actions={
          <button className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <div className="panel">
          <p className="muted">No recovery requests assigned to you.</p>
        </div>
      ) : (
        <div className="recovery-grid">
          {items.map((r) => (
            <div key={r.id} className="recovery-card">
              <div className="recovery-card-header">
                <strong>Request #{r.id}</strong>
                <StatusBadge value={r.status} />
              </div>
              <div className="detail-grid compact">
                <div>
                  <span className="field-label">Incident</span>
                  <div>#{r.incident_id}</div>
                </div>
                <div>
                  <span className="field-label">Broken truck</span>
                  <div>#{r.source_truck_id}</div>
                </div>
                <div>
                  <span className="field-label">Your truck</span>
                  <div>#{r.target_truck_id}</div>
                </div>
                <div>
                  <span className="field-label">Distance</span>
                  <div>{r.distance_km != null ? `${r.distance_km} km` : '—'}</div>
                </div>
                <div>
                  <span className="field-label">Free capacity</span>
                  <div>{r.free_space_kg != null ? `${r.free_space_kg} kg` : '—'}</div>
                </div>
                <div>
                  <span className="field-label">Created</span>
                  <div>{formatDate(r.created_at)}</div>
                </div>
              </div>
              {r.ai_reasoning ? (
                <p className="ai-reasoning">
                  <strong>AI recommendation:</strong> {r.ai_reasoning}
                </p>
              ) : null}
              {r.status === 'pending' ? (
                <div className="status-actions">
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => act(r.id, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => act(r.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
