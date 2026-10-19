import { useCallback, useEffect, useRef } from 'react'

/**
 * Lightweight REST polling hook.
 * Primary live path is WebSocket (/ws/live-map) + Redis; polling is fallback
 * for stats/incidents and for environments where WS is blocked.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const savedFn = useRef(fn)
  savedFn.current = fn

  const tick = useCallback(() => {
    void savedFn.current()
  }, [])

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return undefined
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [tick, intervalMs, enabled])
}

export const POLL_INTERVALS = {
  /** Admin live fleet map / dashboard */
  liveMapMs: 5000,
  /** Driver recovery requests + deliveries */
  driverOpsMs: 6000,
  /** Customer notifications / order status */
  customerFeedMs: 8000,
} as const
