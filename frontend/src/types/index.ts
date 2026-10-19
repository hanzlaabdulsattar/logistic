export type UserRole = 'admin' | 'driver' | 'customer'

export type TruckStatus =
  | 'available'
  | 'in_transit'
  | 'breakdown'
  | 'maintenance'
  | 'off_duty'

export type DriverStatus = 'available' | 'on_delivery' | 'on_leave' | 'suspended'

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'reassigned'

export type ParcelStatus =
  | 'pending'
  | 'loaded'
  | 'in_transit'
  | 'delivered'
  | 'transferred'

export type IncidentType =
  | 'breakdown'
  | 'accident'
  | 'flat_tire'
  | 'engine_failure'
  | 'other'

export type IncidentStatus =
  | 'reported'
  | 'recovery_in_progress'
  | 'resolved'
  | 'closed'

export type RecoveryRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'completed'

export type RecoveryResponseStatus = 'accepted' | 'rejected'

export type MaintenanceType = 'scheduled' | 'emergency' | 'inspection'

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed'

export type NotificationType =
  | 'order_update'
  | 'incident_alert'
  | 'recovery_request'
  | 'recovery_response'
  | 'system'

export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Truck {
  id: number
  plate_number: string
  model: string
  capacity_kg: number
  current_load_kg: number
  status: TruckStatus
  current_lat: number | null
  current_lng: number | null
  created_at: string
  updated_at: string
}

export interface Driver {
  id: number
  user_id: number
  license_number: string
  truck_id: number | null
  status: DriverStatus
  created_at: string
  updated_at: string
  user?: User
  truck?: Truck
}

export interface DriverProfile {
  id: number
  user_id: number
  license_number: string
  truck_id: number | null
  status: DriverStatus
  user: {
    id: number
    email: string
    full_name: string
    phone: string | null
    role: string
  }
  truck: {
    id: number
    plate_number: string
    model: string
    capacity_kg: number
    current_load_kg: number
    status: TruckStatus
    current_lat: number | null
    current_lng: number | null
  } | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: number
  customer_id: number
  driver_id: number | null
  status: OrderStatus
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  pickup_address: string | null
  delivery_address: string | null
  deadline: string | null
  created_at: string
  updated_at: string
  /** Dynamic pricing (backend should store these; UI computes if missing) */
  weight_kg?: number | null
  fragile?: boolean | null
  distance_km?: number | null
  rate_per_km?: number | null
  rate_per_kg?: number | null
  base_fee?: number | null
  handling_fee?: number | null
  amount?: number | null
  currency?: string | null
  pricing_formula?: string | null
  /** Present on customer order APIs after assignment */
  driver_name?: string | null
  driver_phone?: string | null
  driver_license?: string | null
  truck_plate?: string | null
  truck_model?: string | null
  truck_id?: number | null
  truck_lat?: number | null
  truck_lng?: number | null
  truck_status?: string | null
  truck_location_updated_at?: string | null
  /** on_the_way | stopped | idle | delivered | awaiting_accept | ... */
  journey_phase?: string | null
}

export interface Parcel {
  id: number
  order_id: number
  truck_id: number | null
  weight_kg: number
  description: string | null
  status: ParcelStatus
  created_at: string
  updated_at: string
}

export interface Incident {
  id: number
  truck_id: number
  driver_id: number
  type: IncidentType
  description: string | null
  lat: number
  lng: number
  status: IncidentStatus
  created_at: string
  updated_at: string
}

export interface Customer {
  id: number
  user_id: number
  address: string | null
  created_at: string
  updated_at: string
  user?: User
}

export interface RecoveryRequest {
  id: number
  incident_id: number
  source_truck_id: number
  target_truck_id: number
  target_driver_id: number
  status: RecoveryRequestStatus
  distance_km: number | null
  free_space_kg: number | null
  ai_reasoning: string | null
  created_at: string
  updated_at: string
}

export interface RecoveryResponseItem {
  id: number
  recovery_request_id: number
  driver_id: number
  status: RecoveryResponseStatus
  responded_at: string
}

export interface MaintenanceRecord {
  id: number
  truck_id: number
  type: MaintenanceType
  description: string | null
  status: MaintenanceStatus
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Notification {
  id: number
  user_id: number
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface CustomerProfile {
  id: number
  user_id: number
  address: string | null
  user: {
    id: number
    email: string
    full_name: string
    phone: string | null
    role: string
  }
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_trucks: number
  total_drivers: number
  total_orders: number
  total_parcels: number
  total_customers: number
  active_incidents: number
  available_trucks: number
  available_drivers: number
  breakdown_trucks: number
  pending_orders: number
  in_transit_orders: number
  delivered_orders: number
  pending_recovery_requests: number
}

export interface LiveMapTruck {
  id: number
  plate_number: string
  model: string
  status: string
  current_lat: number | null
  current_lng: number | null
  source?: string
  updated_at?: string | null
}

export interface LiveLocationPayload {
  truck_id: number
  lat: number
  lng: number
  status: string | null
  plate_number: string | null
  model: string | null
  updated_at: string | null
  source: string
}

export interface LocationPoint {
  id: number
  truck_id: number
  lat: number
  lng: number
  timestamp: string
}

export interface RecentIncident {
  id: number
  truck_id: number
  driver_id: number
  type: string
  status: string
  lat: number
  lng: number
  created_at: string
}

export interface DashboardOverview {
  stats: DashboardStats
  live_map: LiveMapTruck[]
  recent_incidents: RecentIncident[]
  live_source?: string
  websocket_path?: string
}

export interface GeoLocation {
  lat: number
  lng: number
}

export interface OrderCreatePayload {
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  pickup_address?: string | null
  delivery_address?: string | null
  deadline?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  weight_kg?: number
  fragile?: boolean
  /** Pricing snapshot stored with the order */
  amount?: number
  currency?: string
  distance_km?: number
  rate_per_km?: number
  rate_per_kg?: number
  base_fee?: number
  handling_fee?: number
  pricing_formula?: string
}

export interface DeliveryStatusUpdatePayload {
  status: string
}
