export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export function formatCoord(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return '—'
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return '—'
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function routeForRole(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'driver':
      return '/driver'
    case 'customer':
      return '/customer'
    default:
      return '/login'
  }
}
