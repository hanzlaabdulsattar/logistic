import { useCallback, useState } from 'react'
import type { GeoLocation } from '../types'

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(async (): Promise<GeoLocation> => {
    setLoading(true)
    setError(null)
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const msg = 'Geolocation is not supported by this browser'
        setError(msg)
        setLoading(false)
        reject(new Error(msg))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }
          setLocation(loc)
          setLoading(false)
          resolve(loc)
        },
        (err) => {
          const msg =
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied'
              : 'Unable to get current location'
          setError(msg)
          setLoading(false)
          reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      )
    })
  }, [])

  return { location, loading, error, request, setLocation }
}
