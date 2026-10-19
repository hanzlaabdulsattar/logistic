/**
 * Simple delivery pricing (project rule):
 * - Minimum parcel weight: 3 kg
 * - Maximum parcel weight: 45 kg
 * - Rate: PKR 20 per kilometer (distance only)
 *
 * amount = distance_km × 20
 * Weight is validated, not used in the amount formula.
 */

export const MIN_WEIGHT_KG = 3
export const MAX_WEIGHT_KG = 9999 // no practical max weight — only min is enforced
export const RATE_PER_KM = 20
export const CURRENCY = 'PKR'
export const MIN_DISTANCE_KM = 1 // avoid zero charge for same-point orders
/** Maximum delivery distance (km). Over this → “Distance limit exceeded”. */
export const MAX_DISTANCE_KM = 40

export interface PricingBreakdown {
  currency: string
  base_fee: number
  distance_km: number
  distance_cost: number
  weight_kg: number
  weight_cost: number
  handling_fee: number
  total_amount: number
  rate_per_km: number
  rate_per_kg: number
  formula: string
  min_weight_kg: number
  max_weight_kg: number
  max_distance_km: number
  weight_valid: boolean
  weight_error?: string
  distance_valid: boolean
  distance_error?: string
  /** True when weight or distance is outside allowed range */
  limit_exceeded: boolean
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function validateWeight(weightKg: number): string | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return `Weight must be at least ${MIN_WEIGHT_KG} kg`
  }
  if (weightKg < MIN_WEIGHT_KG) {
    return `Minimum order weight is ${MIN_WEIGHT_KG} kg`
  }
  return null
}

export function validateDistance(distanceKm: number): string | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return 'Invalid distance'
  }
  if (distanceKm > MAX_DISTANCE_KM) {
    return `Distance limit exceeded — max delivery distance is ${MAX_DISTANCE_KM} km (this route is ${distanceKm.toFixed(1)} km)`
  }
  return null
}

export function calculateDeliveryPricing(input: {
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  weight_kg?: number | null
}): PricingBreakdown {
  const weight_kg = Math.max(0, Number(input.weight_kg ?? 0) || 0)
  const weight_error = validateWeight(weight_kg) || undefined
  const rawKm = haversineKm(
    input.pickup_lat,
    input.pickup_lng,
    input.delivery_lat,
    input.delivery_lng,
  )
  const distance_km = Math.round(Math.max(MIN_DISTANCE_KM, rawKm) * 10) / 10
  const distance_error = validateDistance(rawKm) || undefined
  const distance_valid = !distance_error
  const total_amount = distance_valid
    ? Math.round(distance_km * RATE_PER_KM * 100) / 100
    : 0
  const limit_exceeded = !distance_valid

  return {
    currency: CURRENCY,
    base_fee: 0,
    distance_km,
    distance_cost: total_amount,
    weight_kg,
    weight_cost: 0,
    handling_fee: 0,
    total_amount,
    rate_per_km: RATE_PER_KM,
    rate_per_kg: 0,
    formula: distance_valid
      ? `${distance_km} km × PKR ${RATE_PER_KM}/km = PKR ${total_amount}`
      : `Distance ${distance_km} km exceeds max ${MAX_DISTANCE_KM} km — order not allowed`,
    min_weight_kg: MIN_WEIGHT_KG,
    max_weight_kg: MAX_WEIGHT_KG,
    max_distance_km: MAX_DISTANCE_KM,
    weight_valid: !weight_error,
    weight_error,
    distance_valid,
    distance_error,
    limit_exceeded,
  }
}

export function formatMoney(amount: number, currency = CURRENCY): string {
  return `${currency} ${Number(amount).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`
}

export function parseWeightKg(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Deprecated alias kept for older UI imports */
export const DEFAULT_PRICING = {
  currency: CURRENCY,
  base_fee: 0,
  rate_per_km: RATE_PER_KM,
  rate_per_kg: 0,
  handling_fee: 0,
  min_amount: 0,
}
