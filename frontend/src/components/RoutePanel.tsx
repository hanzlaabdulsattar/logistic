import { StatusBadge } from './ui'
import { formatCoord } from '../utils/format'
import type { Order } from '../types'

/**
 * Documentation-style route strip: pickup → delivery
 * (e.g. Lahore → Karachi) with current vehicle location.
 */
export function RoutePanel({
  order,
  vehicleLocation,
  vehicleLabel,
}: {
  order: Order | null
  vehicleLocation?: { lat: number | null; lng: number | null } | null
  vehicleLabel?: string
}) {
  const pickup =
    order?.pickup_address || (order ? formatCoord(order.pickup_lat, order.pickup_lng) : '—')
  const delivery =
    order?.delivery_address || (order ? formatCoord(order.delivery_lat, order.delivery_lng) : '—')

  return (
    <div className="route-panel">
      <div className="route-label">Current route</div>
      <div className="route-line">
        <div className="route-node">
          <span className="route-dot pickup" />
          <div>
            <div className="muted small">Pickup</div>
            <strong>{pickup}</strong>
          </div>
        </div>
        <div className="route-arrow" aria-hidden>
          →
        </div>
        <div className="route-node">
          <span className="route-dot delivery" />
          <div>
            <div className="muted small">Delivery</div>
            <strong>{delivery}</strong>
          </div>
        </div>
      </div>
      <div className="route-meta">
        <div>
          <span className="field-label">Vehicle</span>
          <div>{vehicleLabel || '—'}</div>
        </div>
        <div>
          <span className="field-label">Current location</span>
          <div>
            {vehicleLocation
              ? formatCoord(vehicleLocation.lat, vehicleLocation.lng)
              : 'No GPS yet'}
          </div>
        </div>
        {order ? (
          <div>
            <span className="field-label">Journey status</span>
            <div>
              <StatusBadge value={order.status} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
