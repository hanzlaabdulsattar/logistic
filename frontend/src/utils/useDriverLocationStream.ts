import { useEffect, useRef } from 'react'
import { driverApi } from '../api/endpoints'

const LOCATION_INTERVAL_MS = 5000

/**
 * Streams browser geolocation to the backend while a journey is active.
 * Customer map reads truck.current_lat/lng from order tracking APIs.
 */
export function useDriverLocationStream(options: {
  enabled: boolean
  truckId: number | null | undefined
  status?: 'in_transit' | 'available' | 'breakdown'
  onSent?: (loc: { lat: number; lng: number }) => void
  onError?: (msg: string) => void
}) {
  const { enabled, truckId, status = 'in_transit' } = options
  const optionsRef = useRef(options)
  optionsRef.current = options
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const lastLocRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!enabled || !truckId) {
      if (watchIdRef.current != null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return undefined
    }

    if (!('geolocation' in navigator)) {
      optionsRef.current.onError?.('Geolocation not supported')
      return undefined
    }

    const send = async (lat: number, lng: number) => {
      lastLocRef.current = { lat, lng }
      try {
        await driverApi.updateTruckLocation(truckId, {
          lat,
          lng,
          status: optionsRef.current.status || 'in_transit',
        })
        optionsRef.current.onSent?.({ lat, lng })
      } catch (err) {
        optionsRef.current.onError?.(
          err instanceof Error ? err.message : 'Location upload failed',
        )
      }
    }

    const onPos = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      void send(lat, lng)
    }

    const onErr = (err: GeolocationPositionError) => {
      optionsRef.current.onError?.(
        err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — customer cannot see live position'
          : 'Unable to read GPS',
      )
    }

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 15000,
    })

    // Re-send last known fix periodically so updated_at keeps moving
    timerRef.current = window.setInterval(() => {
      const loc = lastLocRef.current
      if (loc) void send(loc.lat, loc.lng)
    }, LOCATION_INTERVAL_MS)

    return () => {
      if (watchIdRef.current != null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, truckId, status])

  return { lastLocation: lastLocRef.current }
}
