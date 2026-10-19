export interface OrderCreatePayload {
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  pickup_address?: string | null
  delivery_address?: string | null
  deadline?: string | null
}

export interface DeliveryStatusUpdatePayload {
  status: string
}
