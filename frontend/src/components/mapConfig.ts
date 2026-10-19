import L from 'leaflet'

/**
 * Map stack (project standard):
 * - React 18
 * - React-Leaflet (react-leaflet) components
 * - OpenStreetMap raster tiles (free, no API key)
 * - Leaflet (via react-leaflet) for markers/icons
 *
 * Coordinates come from Browser Geolocation (driver START),
 * not from a paid Google Maps GPS service.
 */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const DEFAULT_CENTER: [number, number] = [30.3753, 69.3451] // Pakistan
export const DEFAULT_ZOOM = 5
export const ORDER_ZOOM = 12
export const FLEET_ZOOM = 6

export function truckIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'truck-marker',
    html: `<div class="marker-dot" style="background:${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export const MARKER_COLORS = {
  truck: '#3b82f6',
  pickup: '#22c55e',
  delivery: '#ef4444',
  available: '#22c55e',
  in_transit: '#3b82f6',
  breakdown: '#ef4444',
  maintenance: '#f59e0b',
  off_duty: '#94a3b8',
  reported: '#ef4444',
  recovery_in_progress: '#f59e0b',
  resolved: '#22c55e',
  closed: '#94a3b8',
} as const
