import { api } from './client'
import type {
  CreateSafePayPaymentResponse,
  OrderPaymentSummary,
  Payment,
} from '../types/payments'
import { safePayCancelUrl, safePayReturnUrl } from '../utils/safepayConfig'

/**
 * Payment API client — connects to FastAPI backend.
 * Amounts are always taken from the order's server-side pricing.
 *
 * Backend:
 *   POST /payments/safe-pay
 *   POST /payments/cod
 *   GET  /payments/{payment_id}
 *   POST /payments/{payment_id}/mark-paid
 *   GET  /orders/{order_id}/payment
 */

export interface CreateSafePayPayload {
  order_id: number
  customer_email?: string
  customer_name?: string
  description?: string
}

export const paymentsApi = {
  createSafePayPayment: async (payload: CreateSafePayPayload) => {
    const res = await api.post<CreateSafePayPaymentResponse>('/payments/safe-pay', {
      ...payload,
      provider: 'safepay',
      return_url: safePayReturnUrl(payload.order_id),
      cancel_url: safePayCancelUrl(payload.order_id),
    })
    return res.data
  },

  createCodPayment: async (payload: { order_id: number; note?: string }) => {
    const res = await api.post<{
      payment_id: number
      order_id: number
      amount: number
      currency: string
      status: string
      method: string
      message: string
      payment: Payment
    }>('/payments/cod', {
      order_id: payload.order_id,
      note: payload.note,
    })
    return res.data
  },

  getPayment: async (paymentId: number) => {
    const res = await api.get<Payment>(`/payments/${paymentId}`)
    return res.data
  },

  markPaid: async (
    paymentId: number,
    data?: { status?: string; message?: string; provider_payment_id?: string },
  ) => {
    const res = await api.post<Payment>(`/payments/${paymentId}/mark-paid`, {
      status: data?.status || 'paid',
      message: data?.message || 'Payment verified',
      provider_payment_id: data?.provider_payment_id,
    })
    return res.data
  },

  getOrderPayment: async (orderId: number) => {
    const res = await api.get<OrderPaymentSummary>(`/orders/${orderId}/payment`)
    return res.data
  },
}