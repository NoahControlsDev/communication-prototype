import { useCallback, useEffect, useState } from 'react'

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
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload }
}

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

export const certificatesChanged = () => window.dispatchEvent(new Event('certificates-changed'))

export function ago(t) {
  const s = Math.round((Date.now() - new Date(t).getTime()) / 1000)
  if (s < 60) return `${Math.max(s, 0)}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return new Date(t).toLocaleString()
}

export function until(t) {
  const s = Math.round((new Date(t).getTime() - Date.now()) / 1000)
  if (s <= 60) return 'any moment'
  if (s < 3600) return `in ${Math.round(s / 60)}m`
  return `in ${Math.round(s / 3600)}h`
}

export const profileName = (p) => `${p.key}@${p.major}.${p.minor}`

export const show = (v) =>
  v === null || v === undefined || v === '' ? '—'
    : Array.isArray(v) ? v.join(', ')
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v)
