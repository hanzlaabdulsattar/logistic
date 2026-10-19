import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { titleCase } from '../utils/format'
import { BASE_URL } from '../api/client'

const adminLinks = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/trucks', label: 'Register Trucks' },
  { to: '/admin/drivers', label: 'Drivers' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/incidents', label: 'Incidents' },
  { to: '/admin/recovery', label: 'Recovery' },
  { to: '/admin/parcels', label: 'Parcels' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/maintenance', label: 'Maintenance' },
  { to: '/admin/users', label: 'Users' },
]

const driverLinks = [
  { to: '/driver', label: 'Dashboard', end: true },
  { to: '/driver/deliveries', label: 'Deliveries' },
  { to: '/driver/incidents', label: 'Incidents' },
  { to: '/driver/recovery', label: 'Recovery Requests' },
]

const customerLinks = [
  { to: '/customer', label: 'Dashboard', end: true },
  { to: '/customer/orders', label: 'Orders' },
  { to: '/customer/orders/new', label: 'Create Order' },
  { to: '/customer/parcels', label: 'Parcels' },
  { to: '/customer/payments', label: 'Payments' },
  { to: '/customer/notifications', label: 'Notifications' },
  { to: '/customer/profile', label: 'Profile' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const links =
    user?.role === 'admin'
      ? adminLinks
      : user?.role === 'driver'
        ? driverLinks
        : customerLinks

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">LP</span>
          <div>
            <div className="brand-title">Logistics</div>
            <div className="brand-sub">Management Platform</div>
          </div>
        </div>

        <div className="nav-section-label">{titleCase(user?.role)} Area</div>
        <nav className="nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="api-base muted small" title="Backend base URL">
            API: {BASE_URL || '(via Vite proxy)'}
          </div>
          <div className="user-chip">
            <div className="avatar">{user?.full_name?.charAt(0) || 'U'}</div>
            <div>
              <div className="user-name">{user?.full_name}</div>
              <div className="user-role">
                {titleCase(user?.role)} · {user?.email}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost full"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
