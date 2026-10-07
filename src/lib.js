import { useCallback, useEffect, useState } from 'react'

// Loads data when deps change; call reload() after a change to fetch it again.
export function useLoad(loader, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    loader().then(
      (d) => { if (alive) { setData(d); setError('') } },
      (e) => { if (alive) setError(e.message) },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  // Stable across renders, so it can be used in effect deps and event listeners.
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload }
}

// Wraps a mutation: shows its error, returns true on success.
export function useAction() {
  const [error, setError] = useState('')
  const run = async (fn) => {
    setError('')
    try {
      await fn()
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }
  return { error, setError, run }
}

export const go = (hash) => { window.location.hash = hash }

// Tells the sidebar to refresh its pending-certificate count after a decision.
export const certificatesChanged = () => window.dispatchEvent(new Event('certificates-changed'))

// "12s ago", "5m ago", "3h ago", then a date
export function ago(t) {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000)
  if (s < 60) return `${Math.max(s, 0)}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return new Date(t).toLocaleString()
}

// "in 13h", "in 25m", or "any moment" for a future time
export function until(t) {
  const s = Math.round((new Date(t).getTime() - Date.now()) / 1000)
  if (s <= 60) return 'any moment'
  if (s < 3600) return `in ${Math.round(s / 60)}m`
  return `in ${Math.round(s / 3600)}h`
}

export const profileName = (p) => `${p.key}@${p.major}.${p.minor}`

// Shows null as an em dash, arrays as comma lists, objects as JSON.
export const show = (v) =>
  v === null || v === undefined || v === '' ? '—'
    : Array.isArray(v) ? v.join(', ')
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v)
