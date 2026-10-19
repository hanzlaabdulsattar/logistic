import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { routeForRole } from '../utils/format'

const TEST_ACCOUNTS = [
  { role: 'Admin', email: 'admin@test.com', password: 'admin123' },
  { role: 'Driver', email: 'driver@test.com', password: 'driver123' },
  { role: 'Customer', email: 'customer@test.com', password: 'customer123' },
] as const

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function fillAndLogin(accountEmail: string, accountPassword: string) {
    setEmail(accountEmail)
    setPassword(accountPassword)
    setError(null)
    setBusy(true)
    try {
      const user = await login(accountEmail, accountPassword)
      navigate(routeForRole(user.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = await login(email.trim(), password)
      navigate(routeForRole(user.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
            <h1>Logistics Platform</h1>
            <p>AI-powered fleet & recovery management</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="stack">
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@test.com"
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="error-banner">{error}</div> : null}

          <button className="btn btn-primary full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="test-logins">
          <div className="test-logins-title">Test logins (seed data)</div>
          <div className="test-logins-list">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="test-login-chip"
                disabled={busy}
                onClick={() => void fillAndLogin(acc.email, acc.password)}
              >
                <span className="test-login-role">{acc.role}</span>
                <span className="test-login-cred">
                  {acc.email} / {acc.password}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="auth-foot">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
