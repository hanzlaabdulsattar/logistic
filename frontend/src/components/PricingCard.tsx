import {
  MAX_DISTANCE_KM,
  MIN_WEIGHT_KG,
  RATE_PER_KM,
  formatMoney,
  type PricingBreakdown,
} from '../utils/pricing'

export function PricingBreakdownCard({
  pricing,
  title = 'Delivery pricing',
}: {
  pricing: PricingBreakdown
  title?: string
}) {
  const overDistance = pricing.distance_valid === false
  return (
    <div
      className={`pricing-card${pricing.weight_valid === false || overDistance ? ' invalid' : ''}`}
    >
      <div className="pricing-header">
        <strong>{title}</strong>
        <span className="badge info">PKR {RATE_PER_KM}/km</span>
      </div>

      {overDistance || pricing.limit_exceeded ? (
        <div className="limit-exceeded-banner">
          <strong>⚠ Distance limit exceeded</strong>
          <div>
            This route is <strong>{pricing.distance_km} km</strong> — maximum allowed distance is{' '}
            <strong>{MAX_DISTANCE_KM} km</strong>. Order cannot be created.
          </div>
        </div>
      ) : null}

      <div className="pricing-rows">
        <div className="pricing-row">
          <span>Distance</span>
          <span>
            {pricing.distance_km} km
            <span className="muted"> (max {MAX_DISTANCE_KM} km)</span>
          </span>
        </div>
        <div className="pricing-row">
          <span>Rate</span>
          <span>{formatMoney(pricing.rate_per_km, pricing.currency)} / km</span>
        </div>
        <div className="pricing-row">
          <span>Parcel weight</span>
          <span>
            {pricing.weight_kg} kg
            <span className="muted"> (min {MIN_WEIGHT_KG} kg)</span>
          </span>
        </div>
        <div className="pricing-row total">
          <span>Total amount</span>
          <span>
            {overDistance || pricing.limit_exceeded
              ? '—'
              : formatMoney(pricing.total_amount, pricing.currency)}
          </span>
        </div>
      </div>
      <div className="muted small pricing-formula">{pricing.formula}</div>
      {pricing.weight_error ? (
        <div className="error-banner mt">{pricing.weight_error}</div>
      ) : null}
      {pricing.distance_error ? (
        <div className="error-banner mt">
          <strong>{pricing.distance_error}</strong>
        </div>
      ) : null}
    </div>
  )
}

export function RateConfigHint() {
  return (
    <div className="poll-banner">
      <span className="badge info">Pricing rules</span>
      <span>
        Order weight <strong>min {MIN_WEIGHT_KG} kg</strong> (no max weight) · delivery charge{' '}
        <strong>PKR {RATE_PER_KM} per kilometer</strong> · max distance{' '}
        <strong>{MAX_DISTANCE_KM} km</strong> (beyond this → <em>Distance limit exceeded</em>).
      </span>
    </div>
  )
}
