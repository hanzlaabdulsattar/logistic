import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api/client'

export type ProximitySocketStatus = 'connecting' | 'open' | 'closed' | 'unsupported'

export interface StuckTruckAlert {
  incident_id: number
  radius_km: number
  stuck_truck: {
    truck_id: number
    plate_number: string
    model?: string | null
    lat: number
    lng: number
    incident_type: string
    description?: string | null
    reported_at?: string
  }
  nearby_trucks?: {
    truck_id: number
    plate_number: string
    distance_km: number
    status: string
  }[]
  message: string
  targeted?: boolean
}

/**
 * Driver WebSocket: receives truck_stuck alerts when any truck breaks down
 * within ~10km of this driver (and general fleet alerts).
 */
export function useDriverProximitySocket(onAlert: (alert: StuckTruckAlert) => void) {
  const [status, setStatus] = useState<ProximitySocketStatus>('connecting')
  const handlerRef = useRef(onAlert)
  handlerRef.current = onAlert

  useEffect(() => {
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      setStatus('unsupported')
      return undefined
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const token = getToken()
    const query = token ? `?token=${encodeURIComponent(token)}` : ''
    const candidates = [
      `${proto}://${window.location.host}/ws/driver${query}`,
      `${proto}://127.0.0.1:8000/ws/driver${query}`,
    ]

    let socket: WebSocket | null = null
    let idx = 0
    let closed = false

    const connect = () => {
      if (closed || idx >= candidates.length) {
        setStatus('closed')
        return
      }
      setStatus('connecting')
      const url = candidates[idx]
      socket = new WebSocket(url)

      socket.onopen = () => setStatus('open')
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg?.type === 'truck_stuck' || msg?.type === 'proximity_alert_fanout') {
            // Prefer full truck_stuck payload
            if (msg.stuck_truck) {
              handlerRef.current(msg as StuckTruckAlert)
            } else if (msg.type === 'proximity_alert_fanout' && msg.stuck_truck) {
              handlerRef.current(msg as StuckTruckAlert)
            } else if (msg.truck_stuck) {
              handlerRef.current(msg.truck_stuck as StuckTruckAlert)
            }
          } else if (msg?.type === 'location') {
            // ignore pure GPS frames here
          }
        } catch {
          /* ignore */
        }
      }
      socket.onerror = () => {
        idx += 1
        try {
          socket?.close()
        } catch {
          /* ignore */
        }
      }
      socket.onclose = () => {
        if (!closed && idx < candidates.length - 1) {
          idx += 1
          connect()
        } else if (!closed) {
          setStatus('closed')
        }
      }
    }

    connect()

    return () => {
      closed = true
      try {
        socket?.close()
      } catch {
        /* ignore */
      }
    }
  }, [])

  return { status }
}
