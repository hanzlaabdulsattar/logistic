import { useMemo } from 'react'
import { MapContainer, Marker, Popup, Polyline, TileLayer } from 'react-leaflet'
import type { Order } from '../types'
import { formatCoord, formatDate } from '../utils/format'
import {
  MARKER_COLORS,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  ORDER_ZOOM,
  truckIcon,
} from './mapConfig'
import { FitBounds } from './FitBounds'
import { journeyLabel } from './journeyLabel'

export { journeyLabel } from './journeyLabel'

/**
 * Customer order live-tracking map.
 * Stack: React + React-Leaflet + OpenStreetMap.
 * GPS: driver Browser Geolocation → backend truck lat/lng → order API poll.
 */
export function DriverTrackingMap({ order, height = 380 }: { order: Order; height?: number }) {
  const hasTruck = order.truck_lat != null && order.truck_lng != null
  const phase = journeyLabel(order.journey_phase)

  const points = useMemo(() => {
    const list: Array<[number, number]> = [
      [order.pickup_lat, order.pickup_lng],
      [order.delivery_lat, order.delivery_lng],
    ]
    if (hasTruck) list.push([order.truck_lat as number, order.truck_lng as number])
    return list
  }, [order, hasTruck])

  const center: [number, number] = hasTruck
    ? ([order.truck_lat as number, order.truck_lng as number] as [number, number])
    : [order.delivery_lat, order.delivery_lng]

  return (
    <div className="map-panel" style={{ height }} data-map-stack="react-leaflet+openstreetmap">
      <MapContainer center={center} zoom={ORDER_ZOOM} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url={OSM_TILE_URL}
          maxZoom={19}
        />
        <FitBounds points={points} maxZoom={14} />
        <Marker
          position={[order.pickup_lat, order.pickup_lng]}
          icon={truckIcon(MARKER_COLORS.pickup)}
        >
          <Popup>
            Pickup: {order.pickup_address || formatCoord(order.pickup_lat, order.pickup_lng)}
          </Popup>
        </Marker>
        <Marker
          position={[order.delivery_lat, order.delivery_lng]}
          icon={truckIcon(MARKER_COLORS.delivery)}
        >
          <Popup>
            Delivery: {order.delivery_address || formatCoord(order.delivery_lat, order.delivery_lng)}
          </Popup>
        </Marker>
        {hasTruck ? (
          <>
            <Polyline
              positions={[
                [order.truck_lat as number, order.truck_lng as number],
                [order.delivery_lat, order.delivery_lng],
              ]}
              pathOptions={{ color: MARKER_COLORS.truck, weight: 3, dashArray: '6 8' }}
            />
            <Marker
              position={[order.truck_lat as number, order.truck_lng as number]}
              icon={truckIcon(MARKER_COLORS.truck)}
            >
              <Popup>
                <strong>{order.truck_plate || 'Driver truck'}</strong>
                <div>{order.driver_name || `Driver #${order.driver_id}`}</div>
                <div>{phase.text}</div>
                <div>{formatCoord(order.truck_lat, order.truck_lng)}</div>
                <div className="muted small">
                  Last GPS: {formatDate(order.truck_location_updated_at)}
                </div>
                <div className="muted small">Map: React-Leaflet + OSM</div>
              </Popup>
            </Marker>
          </>
        ) : null}
      </MapContainer>
      {!hasTruck ? (
        <div className="map-overlay-note">
          Waiting for driver GPS… Driver must tap <strong>START</strong> (Browser Geolocation)
          · Map tiles: <strong>OpenStreetMap</strong> via <strong>React-Leaflet</strong>
        </div>
      ) : null}
    </div>
  )
}
