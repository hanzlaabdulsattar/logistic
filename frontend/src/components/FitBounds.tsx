import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

/**
 * React-Leaflet helper: fit map bounds when marker coordinates change.
 * Used so customer/admin maps follow live truck GPS from the backend.
 */
export function FitBounds({
  points,
  maxZoom = 14,
}: {
  points: Array<[number, number]>
  maxZoom?: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom, animate: true })
  }, [map, points, maxZoom])

  return null
}
