import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { routeForRole } from '../utils/format'
import type { UserRole } from '../types'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'customer' as UserRole,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
      })
      navigate('/login', {
        replace: true,
        state: { registered: true, email: form.email.trim() },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">LP</span>
          <div>
            <h1>Create account</h1>
            <p>Join as Admin, Driver, or Customer</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="stack">
          <label className="field">
            <span className="field-label">Full name</span>
            <input
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              required
              minLength={1}
            />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+92 300 0000000"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value as UserRole)}
            >
              <option value="customer">Customer</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          {error ? <div className="error-banner">{error}</div> : null}

          <button className="btn btn-primary full" disabled={busy}>
            {busy ? 'Creating…' : 'Register'}
          </button>
        </form>

        <p className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
