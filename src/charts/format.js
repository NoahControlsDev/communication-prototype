// Number and time formatting shared by the charts.

export const RANGES = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
]

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

// 1,284 / 12.9K for big numbers; up to 2 decimals otherwise.
export function formatValue(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Math.abs(v) >= 10_000 ? compact.format(v) : plain.format(v)
}

export const formatCount = (n) => (n >= 10_000 ? compact.format(n) : new Intl.NumberFormat().format(n))

// Axis ticks: clock time for short ranges, weekday + hour for a week.
export function tickFormatter(range) {
  const opts = range === '7d'
    ? { weekday: 'short', hour: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }
  const f = new Intl.DateTimeFormat(undefined, opts)
  return (t) => f.format(new Date(t))
}

const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
export const formatTime = (t) => full.format(new Date(t))

// API rows → chart rows with numeric time, which Recharts needs for a time scale.
export const toSeries = (points) =>
  points.map((p) => ({ ...p, t: new Date(p.t).getTime(), v: p.v === null ? null : Number(p.v) }))
