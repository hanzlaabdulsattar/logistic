/**
 * SafePay frontend configuration (display only — keys live on the backend).
 *
 * Flow:
 * 1) POST /payments/safe-pay  → { payment_id, checkout_url, ... }
 * 2) Browser goes to checkout_url (SafePay hosted checkout, or the local
 *    demo checkout when the server has no SafePay keys)
 * 3) SafePay POSTs back to the backend (/payments/safepay/return), which verifies
 *    the signature, marks the payment paid and redirects to /customer/payments/result
 * 4) Result page reads GET /payments/{payment_id}
 *
 * safePayReturnUrl only tells the backend which frontend origin to send the user back to.
 */

export type SafePayEnv = 'sandbox' | 'production'

export const SAFEPAY_ENV: SafePayEnv =
  ((import.meta.env.VITE_SAFEPAY_ENV as string | undefined) || 'sandbox') === 'production'
    ? 'production'
    : 'sandbox'

/** Public merchant/API key placeholder — full secret stays on backend */
export const SAFEPAY_PUBLIC_KEY =
  (import.meta.env.VITE_SAFEPAY_PUBLIC_KEY as string | undefined) ||
  'sp_public_demo_key_replace_me'

export const SAFEPAY_MERCHANT_CODE =
  (import.meta.env.VITE_SAFEPAY_MERCHANT_CODE as string | undefined) ||
  'DEMO_MERCHANT'

export function safePayReturnUrl(orderId?: number): string {
  const origin = window.location.origin
  return orderId
    ? `${origin}/customer/payments/result?order_id=${orderId}`
    : `${origin}/customer/payments/result`
}

export function safePayCancelUrl(orderId?: number): string {
  const origin = window.location.origin
  return orderId
    ? `${origin}/customer/payments/result?status=cancelled&order_id=${orderId}`
    : `${origin}/customer/payments/result?status=cancelled`
}

export const SAFE_PAY_BRAND = {
  name: 'SafePay',
  tagline: 'Secure online payments',
  envLabel: SAFEPAY_ENV === 'production' ? 'Live' : 'Sandbox',
  docsHint:
    'You will be redirected to SafePay. Payment is confirmed by the server after SafePay verifies it.',
} as const
