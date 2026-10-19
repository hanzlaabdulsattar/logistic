import { api } from './client'
import type {
  Customer,
  CustomerProfile,
  DashboardOverview,
  DashboardStats,
  DeliveryStatusUpdatePayload,
  Driver,
  DriverProfile,
  Incident,
  LiveLocationPayload,
  LiveMapTruck,
  LocationPoint,
  MaintenanceRecord,
  Notification,
  Order,
  OrderCreatePayload,
  Parcel,
  RecoveryRequest,
  RecoveryResponseItem,
  TokenResponse,
  Truck,
  User,
} from '../types'

// ---------- Auth ----------
export const authApi = {
  register: (data: {
    email: string
    password: string
    full_name: string
    phone?: string | null
    role: string
  }) => api.post<User>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>('/auth/login', data),
  me: () => api.get<User>('/auth/me'),
}

// ---------- Admin ----------
export const adminApi = {
  // Dashboard
  dashboardStats: () => api.get<DashboardStats>('/admin/dashboard/stats'),
  liveMap: () => api.get<LiveMapTruck[]>('/admin/dashboard/live-map'),
  liveLocations: () => api.get<LiveLocationPayload[]>('/admin/dashboard/live-locations'),
  truckLocationHistory: (truckId: number, limit = 100) =>
    api.get<LocationPoint[]>(`/admin/dashboard/trucks/${truckId}/location-history`, {
      params: { limit },
    }),
  overview: () => api.get<DashboardOverview>('/admin/dashboard/overview'),

  // Trucks
  listTrucks: (params?: { status?: string }) =>
    api.get<Truck[]>('/admin/trucks/', { params }),
  createTruck: (data: { plate_number: string; model: string; capacity_kg: number }) =>
    api.post<Truck>('/admin/trucks/', data),
  updateTruck: (
    id: number,
    data: Partial<{
      model: string
      capacity_kg: number
      status: string
    }>,
  ) => api.put<Truck>(`/admin/trucks/${id}`, data),
  deleteTruck: (id: number) => api.delete(`/admin/trucks/${id}`),

  // Drivers
  listDrivers: (params?: { status?: string; truck_id?: number }) =>
    api.get<Driver[]>('/admin/drivers/', { params }),
  createDriver: (data: { user_id: number; license_number: string; truck_id?: number | null }) =>
    api.post<Driver>('/admin/drivers/', data),
  updateDriver: (
    id: number,
    data: Partial<{ license_number: string; truck_id: number | null; status: string }>,
  ) => api.put<Driver>(`/admin/drivers/${id}`, data),
  deleteDriver: (id: number) => api.delete(`/admin/drivers/${id}`),

  // Orders
  listOrders: (params?: { status?: string; customer_id?: number; driver_id?: number }) =>
    api.get<Order[]>('/admin/orders/', { params }),
  createOrder: (data: OrderCreatePayload & { customer_id: number; driver_id?: number | null }) =>
    api.post<Order>('/admin/orders/', data),
  assignUnassignedOrders: () =>
    api.post<{ assigned: number; message: string }>('/admin/orders/assign-unassigned'),
  assignOrderDriver: (orderId: number, driverId: number | null) =>
    api.put<Order>(`/admin/orders/${orderId}/assign-driver?driver_id=${driverId ?? ''}`),
  reassignOrder: (orderId: number, toDriverId: number, reason?: string) =>
    api.post<Order>(
      `/admin/orders/${orderId}/reassign?to_driver_id=${toDriverId}` +
        (reason ? `&reason=${encodeURIComponent(reason)}` : ''),
    ),
  driverWorkload: () =>
    api.get<{
      drivers: {
        driver_id: number
        name: string
        email: string | null
        status: string
        truck_id: number | null
        open_orders: number
      }[]
    }>('/admin/orders/driver-workload'),
  updateOrder: (
    id: number,
    data: Partial<{
      driver_id: number | null
      status: string
      pickup_lat: number
      pickup_lng: number
      delivery_lat: number
      delivery_lng: number
      pickup_address: string | null
      delivery_address: string | null
      deadline: string | null
    }>,
  ) => api.put<Order>(`/admin/orders/${id}`, data),
  deleteOrder: (id: number) => api.delete(`/admin/orders/${id}`),

  // Incidents
  listIncidents: (params?: { status?: string; truck_id?: number; driver_id?: number }) =>
    api.get<Incident[]>('/admin/incidents/', { params }),
  createIncident: (data: {
    truck_id: number
    driver_id: number
    type: string
    description?: string | null
    lat: number
    lng: number
    status?: string
  }) => api.post<Incident>('/admin/incidents/', data),
  getIncident: (id: number) => api.get<Incident>(`/admin/incidents/${id}`),
  updateIncident: (
    id: number,
    data: Partial<{
      description: string
      lat: number
      lng: number
      status: string
    }>,
  ) => api.put<Incident>(`/admin/incidents/${id}`, data),
  resolveIncident: (id: number, status = 'resolved') =>
    api.post<Incident>(`/admin/incidents/${id}/resolve`, { status }),
  deleteIncident: (id: number) => api.delete(`/admin/incidents/${id}`),

  // Customers
  listCustomers: () => api.get<Customer[]>('/admin/customers/'),
  createCustomer: (data: { user_id: number; address?: string | null }) =>
    api.post<Customer>('/admin/customers/', data),
  updateCustomer: (id: number, data: { address?: string | null }) =>
    api.put<Customer>(`/admin/customers/${id}`, data),
  deleteCustomer: (id: number) => api.delete(`/admin/customers/${id}`),

  // Parcels
  listParcels: (params?: { order_id?: number; truck_id?: number; status?: string }) =>
    api.get<Parcel[]>('/admin/parcels/', { params }),
  createParcel: (data: {
    order_id: number
    truck_id?: number | null
    weight_kg: number
    description?: string | null
  }) => api.post<Parcel>('/admin/parcels/', data),
  updateParcel: (
    id: number,
    data: Partial<{
      truck_id: number | null
      weight_kg: number
      description: string | null
      status: string
    }>,
  ) => api.put<Parcel>(`/admin/parcels/${id}`, data),
  deleteParcel: (id: number) => api.delete(`/admin/parcels/${id}`),

  // Recovery
  listRecoveryRequests: (params?: { incident_id?: number; status?: string }) =>
    api.get<RecoveryRequest[]>('/admin/recovery/requests', { params }),
  getRecoveryRequest: (id: number) =>
    api.get<RecoveryRequest>(`/admin/recovery/requests/${id}`),
  listRecoveryResponses: (params?: { request_id?: number }) =>
    api.get<RecoveryResponseItem[]>('/admin/recovery/responses', { params }),

  // Maintenance
  listMaintenance: (params?: { truck_id?: number; status?: string }) =>
    api.get<MaintenanceRecord[]>('/admin/maintenance/', { params }),
  createMaintenance: (data: {
    truck_id: number
    type: string
    description?: string | null
    scheduled_at?: string | null
  }) => api.post<MaintenanceRecord>('/admin/maintenance/', data),
  updateMaintenance: (
    id: number,
    data: Partial<{
      description: string | null
      status: string
      scheduled_at: string | null
      completed_at: string | null
    }>,
  ) => api.put<MaintenanceRecord>(`/admin/maintenance/${id}`, data),
  deleteMaintenance: (id: number) => api.delete(`/admin/maintenance/${id}`),

  // Users
  listUsers: (params?: { role?: string; is_active?: boolean }) =>
    api.get<User[]>('/admin/users/', { params }),
  getUser: (id: number) => api.get<User>(`/admin/users/${id}`),
  updateUser: (
    id: number,
    data: Partial<{
      full_name: string
      phone: string
      role: string
      is_active: boolean
    }>,
  ) => api.put<User>(`/admin/users/${id}`, data),
}

// ---------- Driver ----------
export const driverApi = {
  profile: () => api.get<DriverProfile>('/driver/profile/me'),
  updateStatus: (status: string) =>
    api.patch<DriverProfile>('/driver/profile/status', { status }),

  myTruck: () => api.get<Truck>('/driver/trucks/my'),
  getTruck: (truckId: number) => api.get<Truck>(`/driver/trucks/${truckId}`),
  updateTruckStatus: (truckId: number, status: string) =>
    api.patch<Truck>(`/driver/trucks/${truckId}/status`, { status }),
  updateTruckLocation: (
    truckId: number,
    data: { lat: number; lng: number; status?: string },
  ) => api.post<Truck>(`/driver/trucks/${truckId}/location`, data),

  listDeliveries: (params?: { status?: string }) =>
    api.get<Order[]>('/driver/deliveries/', { params }),
  listIncomingOrders: () => api.get<Order[]>('/driver/deliveries/incoming'),
  listAcceptedDeliveries: () => api.get<Order[]>('/driver/deliveries/accepted'),
  acceptOrder: (orderId: number) =>
    api.post<Order>(`/driver/deliveries/${orderId}/accept`),
  rejectOrder: (orderId: number) =>
    api.post<Order>(`/driver/deliveries/${orderId}/reject`),
  getDelivery: (orderId: number) => api.get<Order>(`/driver/deliveries/${orderId}`),
  updateDeliveryStatus: (orderId: number, data: DeliveryStatusUpdatePayload) =>
    api.patch<Order>(`/driver/deliveries/${orderId}/status`, data),

  reportIncident: (data: {
    type: string
    description?: string | null
    lat: number
    lng: number
  }) => api.post<Incident>('/driver/incidents/', data),
  listIncidents: (params?: { status?: string }) =>
    api.get<Incident[]>('/driver/incidents/', { params }),
  listFleetIncidents: (params?: { status?: string }) =>
    api.get<Incident[]>('/driver/incidents/fleet', { params }),
  listNearbyTrucks: (radiusKm = 10) =>
    api.get<
      {
        truck_id: number
        plate_number: string
        model: string
        status: string
        lat: number
        lng: number
        distance_km: number
      }[]
    >('/driver/incidents/nearby', { params: { radius_km: radiusKm } }),
  getIncident: (incidentId: number) =>
    api.get<Incident>(`/driver/incidents/${incidentId}`),

  listNotifications: (params?: { unread_only?: boolean }) =>
    api.get<Notification[]>('/driver/notifications/', { params }),
  markNotificationRead: (notificationId: number) =>
    api.post<Notification>(`/driver/notifications/${notificationId}/read`),

  listRecoveryRequests: (params?: { status?: string }) =>
    api.get<RecoveryRequest[]>('/driver/recovery/requests', { params }),
  acceptRecovery: (requestId: number) =>
    api.post<RecoveryRequest>(`/driver/recovery/requests/${requestId}/accept`),
  rejectRecovery: (requestId: number) =>
    api.post<RecoveryRequest>(`/driver/recovery/requests/${requestId}/reject`),
}

// ---------- Customer / User ----------
export const userApi = {
  profile: () => api.get<CustomerProfile>('/user/profile/me'),
  updateProfile: (data: { address?: string; full_name?: string; phone?: string }) =>
    api.patch<CustomerProfile>('/user/profile/me', data),

  listOrders: (params?: { status?: string }) =>
    api.get<Order[]>('/user/orders/', { params }),
  createOrder: (data: OrderCreatePayload) => api.post<Order>('/user/orders/', data),
  getOrder: (orderId: number) => api.get<Order>(`/user/orders/${orderId}`),
  cancelOrder: (orderId: number) => api.post<Order>(`/user/orders/${orderId}/cancel`),

  listParcels: (params?: { order_id?: number; status?: string }) =>
    api.get<Parcel[]>('/user/parcels/', { params }),
  getParcel: (parcelId: number) => api.get<Parcel>(`/user/parcels/${parcelId}`),

  listNotifications: (params?: { unread_only?: boolean; type?: string }) =>
    api.get<Notification[]>('/user/notifications/', { params }),
  markNotificationRead: (notificationId: number) =>
    api.post<Notification>(`/user/notifications/${notificationId}/read`),
}
