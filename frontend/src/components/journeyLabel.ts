export function journeyLabel(phase: string | null | undefined): {
  text: string
  tone: 'ok' | 'info' | 'warn' | 'danger' | 'muted'
} {
  switch (phase) {
    case 'on_the_way':
      return { text: 'Driver on the way', tone: 'info' }
    case 'stopped':
      return { text: 'Driver stopped / paused', tone: 'warn' }
    case 'awaiting_accept':
      return { text: 'Waiting for driver to accept', tone: 'warn' }
    case 'delivered':
      return { text: 'Delivered', tone: 'ok' }
    case 'cancelled':
      return { text: 'Cancelled', tone: 'muted' }
    case 'reassigned':
      return { text: 'Reassigned (recovery vehicle)', tone: 'warn' }
    default:
      return { text: phase ? phase : 'Tracking unavailable', tone: 'muted' }
  }
}
