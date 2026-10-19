import type { ReactNode } from 'react'
import { titleCase } from '../utils/format'

const TONES: Record<string, string> = {
  available: 'ok',
  in_transit: 'info',
  breakdown: 'danger',
  maintenance: 'warn',
  off_duty: 'muted',
  on_delivery: 'info',
  on_leave: 'warn',
  suspended: 'danger',
  pending: 'warn',
  assigned: 'info',
  delivered: 'ok',
  cancelled: 'muted',
  reassigned: 'warn',
  loaded: 'info',
  transferred: 'info',
  reported: 'danger',
  recovery_in_progress: 'warn',
  resolved: 'ok',
  closed: 'muted',
  accepted: 'ok',
  rejected: 'danger',
  completed: 'ok',
  in_progress: 'info',
  scheduled: 'info',
  open: 'danger',
  emergency: 'danger',
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="badge muted">—</span>
  const tone = TONES[value] || 'info'
  return <span className={`badge ${tone}`}>{titleCase(value)}</span>
}

export function StatCard({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'info'
  hint?: string
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="inline-loading">
      <div className="spinner sm" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>
}

export function SuccessBanner({ message }: { message: string }) {
  return <div className="success-banner">{message}</div>
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${wide ? ' wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
