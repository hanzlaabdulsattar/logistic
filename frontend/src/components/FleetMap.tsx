import { useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type { LiveMapTruck, RecentIncident } from '../types'
import { formatCoord, titleCase } from '../utils/format'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MARKER_COLORS,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  truckIcon,
} from './mapConfig'
import { FitBounds } from './FitBounds'

/**
 * Admin live fleet map.
 * Stack: React + React-Leaflet + OpenStreetMap tiles.
 * Data: REST poll → truck lat/lng from backend.
 */
export function FleetMap({
  trucks,
  incidents,
  height = 420,
}: {
  trucks: LiveMapTruck[]
  incidents?: RecentIncident[]
  height?: number
}) {
  const located = useMemo(
    () => trucks.filter((t) => t.current_lat != null && t.current_lng != null),
    [trucks],
  )

  const truckPoints = useMemo(
    () => located.map((t) => [t.current_lat as number, t.current_lng as number] as [number, number]),
    [located],
  )
  const incidentPoints = useMemo(
    () =>
      (incidents || [])
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => [i.lat, i.lng] as [number, number]),
    [incidents],
  )

  const center = located[0]
    ? ([located[0].current_lat as number, located[0].current_lng as number] as [number, number])
    : DEFAULT_CENTER

  return (
    <div className="map-panel" style={{ height }} data-map-stack="react-leaflet+openstreetmap">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        {/* OpenStreetMap tiles via React-Leaflet TileLayer */}
        <TileLayer
          attribution={OSM_ATTRIBUTION}
          url={OSM_TILE_URL}
          maxZoom={19}
        />
        {truckPoints.length || incidentPoints.length ? (
          <FitBounds points={[...truckPoints, ...incidentPoints]} maxZoom={12} />
        ) : null}
        {located.map((t) => (
          <Marker
            key={`truck-${t.id}`}
            position={[t.current_lat as number, t.current_lng as number]}
            icon={truckIcon(MARKER_COLORS[t.status as keyof typeof MARKER_COLORS] || MARKER_COLORS.truck)}
          >
            <Popup>
              <strong>{t.plate_number}</strong>
              <div>{t.model}</div>
              <div>Status: {titleCase(t.status)}</div>
              <div>{formatCoord(t.current_lat, t.current_lng)}</div>
              <div className="muted small">Source: React-Leaflet + OpenStreetMap</div>
            </Popup>
          </Marker>
        ))}
        {incidents?.map((i) => (
          <Marker
            key={`inc-${i.id}`}
            position={[i.lat, i.lng]}
            icon={truckIcon(MARKER_COLORS[i.status as keyof typeof MARKER_COLORS] || MARKER_COLORS.breakdown)}
          >
            <Popup>
              <strong>Incident #{i.id}</strong>
              <div>{titleCase(i.type)}</div>
              <div>{titleCase(i.status)}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!located.length ? (
        <div className="map-overlay-note">
          No live truck coordinates yet — start a journey or update truck location.
          Map tiles: <strong>OpenStreetMap</strong> · Components: <strong>React-Leaflet</strong>
        </div>
      ) : (
        <div className="map-overlay-note">
          Markers follow GPS via REST polling · Map: <strong>React + React-Leaflet + OSM</strong>
        </div>
      )}
    </div>
  )
}
