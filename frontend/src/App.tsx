import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminTrucks } from './pages/admin/AdminTrucks'
import { AdminDrivers } from './pages/admin/AdminDrivers'
import { AdminOrders } from './pages/admin/AdminOrders'
import { AdminIncidents } from './pages/admin/AdminIncidents'
import { AdminRecovery } from './pages/admin/AdminRecovery'
import { AdminCustomers, AdminParcels } from './pages/admin/AdminCustomers'
import { AdminMaintenance, AdminUsers } from './pages/admin/AdminMaintenance'
import {
  DriverDashboard,
  DriverDeliveries,
  DriverIncidents,
  DriverRecovery,
} from './pages/driver/DriverPages'
import {
  CustomerCreateOrder,
  CustomerDashboard,
  CustomerNotifications,
  CustomerOrderDetail,
  CustomerOrders,
  CustomerParcels,
  CustomerProfile,
} from './pages/customer/CustomerPages'
import {
  CustomerOrderPay,
  CustomerPaymentResult,
  CustomerPayments,
  SafePayCheckoutPage,
} from './pages/customer/PaymentPages'
import { useAuth } from './context/AuthContext'
import { routeForRole } from './utils/format'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={routeForRole(user.role)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* Admin */}
              <Route element={<RequireAuth roles={['admin']} />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/trucks" element={<AdminTrucks />} />
                <Route path="/admin/drivers" element={<AdminDrivers />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/incidents" element={<AdminIncidents />} />
                <Route path="/admin/recovery" element={<AdminRecovery />} />
                <Route path="/admin/parcels" element={<AdminParcels />} />
                <Route path="/admin/customers" element={<AdminCustomers />} />
                <Route path="/admin/maintenance" element={<AdminMaintenance />} />
                <Route path="/admin/users" element={<AdminUsers />} />
              </Route>

              {/* Driver */}
              <Route element={<RequireAuth roles={['driver']} />}>
                <Route path="/driver" element={<DriverDashboard />} />
                <Route path="/driver/deliveries" element={<DriverDeliveries />} />
                <Route path="/driver/incidents" element={<DriverIncidents />} />
                <Route path="/driver/recovery" element={<DriverRecovery />} />
              </Route>

              {/* Customer */}
              <Route element={<RequireAuth roles={['customer']} />}>
                <Route path="/customer" element={<CustomerDashboard />} />
                <Route path="/customer/orders" element={<CustomerOrders />} />
                <Route path="/customer/orders/new" element={<CustomerCreateOrder />} />
                <Route path="/customer/orders/:id" element={<CustomerOrderDetail />} />
                <Route path="/customer/orders/:id/pay" element={<CustomerOrderPay />} />
                <Route path="/customer/parcels" element={<CustomerParcels />} />
                <Route path="/customer/notifications" element={<CustomerNotifications />} />
                <Route path="/customer/profile" element={<CustomerProfile />} />
                <Route path="/customer/payments" element={<CustomerPayments />} />
                <Route path="/customer/payments/result" element={<CustomerPaymentResult />} />
              </Route>

              {/* SafePay hosted/sandbox checkout (public — customer must return here) */}
              <Route path="/customer/payments/checkout" element={<SafePayCheckoutPage />} />
            </Route>
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
