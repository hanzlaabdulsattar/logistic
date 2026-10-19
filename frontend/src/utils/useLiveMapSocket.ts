import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api/client'

export type LiveSocketStatus = 'connecting' | 'open' | 'closed' | 'unsupported'

/**
 * Connects to backend WebSocket /ws/live-map and merges truck GPS updates.
 * Falls back silently if WS fails — REST polling still works.
 */
export function useLiveMapSocket(onTruck: (truck: LiveTruckUpdate) => void) {
  const [status, setStatus] = useState<LiveSocketStatus>('connecting')
  const handlerRef = useRef(onTruck)
  handlerRef.current = onTruck

  useEffect(() => {
    if (typeof window === 'undefined' || !('WebSocket' in window)) {
      setStatus('unsupported')
      return undefined
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Prefer same-origin via Vite proxy path; also try direct API host
    const token = getToken()
    const query = token ? `?token=${encodeURIComponent(token)}` : ''
    const candidates = [
      `${proto}://${window.location.host}/ws/live-map${query}`,
      `${proto}://127.0.0.1:8000/ws/live-map${query}`,
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
          if (msg?.type === 'location' && msg.truck) {
            handlerRef.current({
              id: msg.truck.truck_id,
              plate_number: msg.truck.plate_number,
              model: msg.truck.model,
              status: msg.truck.status,
              current_lat: msg.truck.lat,
              current_lng: msg.truck.lng,
              source: 'websocket',
              updated_at: msg.truck.updated_at,
            })
          } else if (msg?.type === 'snapshot' && Array.isArray(msg.trucks)) {
            for (const t of msg.trucks) {
              handlerRef.current({
                id: t.truck_id,
                plate_number: t.plate_number,
                model: t.model,
                status: t.status,
                current_lat: t.lat,
                current_lng: t.lng,
                source: 'websocket',
                updated_at: t.updated_at,
              })
            }
          }
        } catch {
          /* ignore malformed frames */
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

export interface LiveTruckUpdate {
  id: number
  plate_number?: string | null
  model?: string | null
  status?: string | null
  current_lat: number | null
  current_lng: number | null
  source?: string
  updated_at?: string | null
}
