export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'

export type PaymentMethod = 'safepay' | 'cod' | 'card'

export interface Payment {
  id: number
  order_id: number
  customer_id?: number | null
  amount: number
  currency: string
  method: PaymentMethod | string
  provider?: string | null
  provider_payment_id?: string | null
  status: PaymentStatus | string
  checkout_url?: string | null
  message?: string | null
  created_at: string
  updated_at?: string | null
}

export interface CreateSafePayPaymentResponse {
  payment_id: number
  order_id: number
  amount: number
  currency: string
  status: string
  /** Hosted checkout URL from backend / SafePay session */
  checkout_url: string
  provider: string
  message?: string | null
  /** True when frontend mock/sandbox UI is used because backend endpoint is missing */
  demo_mode?: boolean
}

export interface OrderPaymentSummary {
  order_id: number
  order_status: string
  amount: number
  currency: string
  payment?: Payment | null
  can_pay: boolean
}
