import { useEffect, useState } from 'react'
import DevicesPage from './pages/DevicesPage.jsx'
import ProfilesPage from './pages/ProfilesPage.jsx'
import LookupPage from './pages/LookupPage.jsx'
import SystemPage from './pages/SystemPage.jsx'
import SystemsPage from './pages/SystemsPage.jsx'
import BirthCertificatesPage from './pages/BirthCertificatesPage.jsx'
import DataPage from './pages/DataPage.jsx'
import FieldsPage from './pages/FieldsPage.jsx'
import PlantPage from './pages/PlantPage.jsx'
import { api } from './api.js'
import { useLoad, go } from './lib.js'
import { COMPANY, GatewayDot } from './ui.jsx'
import './App.css'

const REFRESH_MS = 5_000
const NOT_YET = 'Not available in this prototype yet'

function useRoute() {
  const parse = () => {
    const [page = 'devices', part, tab] = window.location.hash.replace(/^#\/?/, '').split('/')
    const id = /^\d+$/.test(part ?? '') ? Number(part) : null
    return { page: page || 'devices', id, sub: id ? tab ?? null : part ?? null }
  }
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

const SEVERITY_RANK = { critical: 3, warning: 2, offline: 1 }

function openAlerts(alerts, key) {
  const found = new Map()
  for (const a of alerts) {
    if (a.state === 'resolved' || a.silenced || a[key] === null) continue
    const entry = found.get(a[key]) ?? { severity: a.severity, count: 0 }
    entry.count += 1
    if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[entry.severity]) entry.severity = a.severity
    found.set(a[key], entry)
  }
  return found
}

function AlertMark({ alert }) {
  const text = `${alert.count} open alert${alert.count === 1 ? '' : 's'}`
  return (
    <svg className={`nav-alert alert-${alert.severity}`} viewBox="0 0 16 16" role="img" aria-label={text}>
      <title>{text}</title>
      <path d="M8 1.6 15 14H1z" />
      <path className="nav-alert-mark" d="M8 6.2v3.6M8 11.8v.2" />
    </svg>
  )
}

function buildSections({ systems, devices, gateways, pending, alerts }) {
  const byDevice = openAlerts(alerts, 'device_id')
  const bySystem = openAlerts(alerts, 'system_id')
  const page = (href, label, extra) => ({ href, label, pages: [href.slice(2)], ...extra })
  return [
    { id: 'company', label: 'Company', items: [{ label: COMPANY }] },
    { id: 'users', label: 'Users' },
    { id: 'sites', label: 'Sites' },
    { id: 'buildings', label: 'Buildings' },
    {
      id: 'systems', label: 'Systems',
      items: [
        { href: '#/systems', label: 'All systems', all: true, page: 'systems', id: null },
        ...systems.map((s) => ({ href: `#/systems/${s.id}`, label: s.name, page: 'systems', id: s.id, alert: bySystem.get(s.id) })),
      ],
    },
    {
      id: 'devices', label: 'Devices',
      items: [
        { href: '#/devices', label: 'All devices', all: true, page: 'devices', id: null },
        ...devices.map((d) => ({ href: `#/devices/${d.id}`, label: d.name, page: 'devices', id: d.id, alert: byDevice.get(d.id) })),
      ],
    },
    {
      id: 'gateways', label: 'Gateways',
      items: [
        { href: '#/gateways', label: 'All gateways', all: true, pages: ['gateways'] },
        ...gateways.map((g) => ({ href: '#/gateways', label: g.gateway_key, status: g.status ?? null, never: true })),
      ],
    },
    {
      id: 'commissioning', label: 'Commissioning',
      items: [
        page('#/certificates', 'Birth certificates', { count: pending }),
        page('#/fields', 'Fields'),
        page('#/profiles', 'Profiles'),
      ],
    },
    { id: 'monitoring', label: 'Monitoring', items: [page('#/plant', 'Plant'), page('#/data', 'Data')] },
    { id: 'account', label: 'Account' },
  ]
}

const isActive = (item, route) =>
  !item.never && (item.pages ? item.pages.includes(route.page) : item.page === route.page && item.id === route.id)

const Chevron = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 2.5 8 6l-3.5 3.5" />
  </svg>
)

function Logo() {
  const [missing, setMissing] = useState(false)
  return (
    <a className="logo" href="#/devices" aria-label={COMPANY}>
      {missing
        ? <span className="wordmark"><b>noah</b>controls<small>inc</small></span>
        : <img src="/logo.png" alt={COMPANY} onError={() => setMissing(true)} />}
    </a>
  )
}

export default function App() {
  const route = useRoute()
  const { page, id, sub } = route

  const pending = useLoad(() => api.certificates('pending'), [page, id])
  const systems = useLoad(() => api.list('systems'), [page, id])
  const devices = useLoad(api.devices, [page, id])
  const gateways = useLoad(() => api.list('gateways'), [page, id])
  const health = useLoad(api.health, [page, id])
  const alerts = useLoad(() => api.alerts(), [page, id])
  const reloads = [pending.reload, systems.reload, devices.reload, gateways.reload, health.reload, alerts.reload]
  useEffect(() => {
    const reloadAll = () => reloads.forEach((r) => r())
    window.addEventListener('certificates-changed', reloadAll)
    const t = setInterval(reloadAll, REFRESH_MS)
    return () => { window.removeEventListener('certificates-changed', reloadAll); clearInterval(t) }
  }, reloads)

  const sections = buildSections({
    systems: systems.data ?? [], devices: devices.data ?? [], gateways: gateways.data ?? [],
    pending: pending.data?.length ?? 0, alerts: alerts.data ?? [],
  })
  const currentSection = sections.find((s) => s.items?.some((i) => isActive(i, route)))?.id

  const [open, setOpen] = useState(() => new Set(['company']))
  const toggle = (sid) => setOpen((s) => { const n = new Set(s); if (n.has(sid)) n.delete(sid); else n.add(sid); return n })
  const [seen, setSeen] = useState(null)
  if (currentSection && currentSection !== seen) {
    setSeen(currentSection)
    setOpen((s) => new Set(s).add(currentSection))
  }

  const [query, setQuery] = useState('')
  const search = (e) => {
    e.preventDefault()
    if (query.trim()) go(`#/fields/${encodeURIComponent(query.trim())}`)
  }

  const known = (gateways.data ?? []).filter((g) => g.status)
  const online = known.filter((g) => g.status === 'online').length
  const backendUp = Boolean(health.data) && !health.error

  return (
    <div className="app">
      <header className="topbar">
        <Logo />
        <div className="top-fact"><span>Company</span><strong>{COMPANY}</strong></div>

        <div className="top-right">
          <select className="context-select" disabled title={NOT_YET} aria-label="Building and role">
            <option>All buildings</option>
          </select>
          <form className="top-search" onSubmit={search} role="search">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search portal" aria-label="Search fields, devices and gateways" />
            <button>Search</button>
          </form>
          <div className="top-fact"><span>Portal Access</span><strong>Administrator</strong></div>
          <div className="top-fact role"><span>Operational Role</span><strong>Building Operator</strong></div>
          <button className="sign-out" disabled title={NOT_YET}>Sign Out</button>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <nav aria-label="Portal">
            {sections.map((s) => {
              const expanded = Boolean(s.items) && open.has(s.id)
              return (
                <div key={s.id} className="nav-section">
                  <button className="nav-head" disabled={!s.items} title={s.items ? undefined : NOT_YET}
                    aria-expanded={expanded} onClick={() => toggle(s.id)}>
                    {s.label}<Chevron />
                  </button>
                  {expanded && (
                    <div className="nav-items">
                      {s.items.map((item, i) => item.href ? (
                        <a key={i} href={item.href}
                          className={`nav-item ${item.all ? 'all' : ''} ${isActive(item, route) ? 'active' : ''}`}>
                          {'status' in item && <GatewayDot status={item.status} />}
                          <span className="nav-label">{item.label}</span>
                          {item.alert && <AlertMark alert={item.alert} />}
                          {item.count > 0 && <span className="count">{item.count}</span>}
                        </a>
                      ) : (
                        <span key={i} className="nav-item static" title={NOT_YET}>{item.label}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="content">
          {page === 'plant' && <PlantPage />}
          {page === 'data' && <DataPage tab={sub} />}
          {page === 'fields' && <FieldsPage key={sub ?? ''} search={sub} />}
          {page === 'devices' && <DevicesPage key={id} id={id} tab={sub} />}
          {page === 'profiles' && <ProfilesPage key={id} id={id} />}
          {page === 'certificates' && <BirthCertificatesPage key={id} id={id} />}
          {page === 'systems' && id && <SystemPage key={id} id={id} tab={sub} />}
          {page === 'systems' && !id && <SystemsPage />}
          {page === 'gateways' && (
            <LookupPage key="gateways" title="Gateways" resource="gateways" field="gateway_key" column="Gateway ID"
              subtitle="Site controllers that announce devices and publish their data over MQTT."
              placeholder="GATEWAY_ID, e.g. GW-01" />
          )}
        </main>
      </div>

      <footer className="statusbar">
        <strong><span className={`dot ${backendUp ? 'dark' : 'danger'}`} />{backendUp ? 'Live Data' : 'Backend unreachable'}</strong>
        <span className="status-note">
          {!backendUp ? 'The API is not responding.'
            : known.length ? `${online} of ${known.length} gateways online.` : 'No gateway has connected yet.'}
        </span>
      </footer>
    </div>
  )
}
