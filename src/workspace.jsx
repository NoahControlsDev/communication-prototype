import { api } from './api.js'
import { useLoad } from './lib.js'
import { Errors } from './ui.jsx'
import { formatValue } from './charts/format.js'

// Pieces shared by the device and system workspaces: status pills, tabs, value tiles, and the
// Alerts / Events / Documents tabs.

export const NOT_YET = 'Not available in this prototype yet'

const ICONS = {
  normal: 'M5.2 8.2l2 2 3.6-4',
  warning: 'M8 4.6v4.2M8 11.2v.2',
  critical: 'M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4',
  info: 'M8 7.4v3.8M8 4.8v.2',
}

// Solid status pill: normal (green), warning (yellow), critical (red), offline (slate), info (navy).
export function Pill({ tone = 'normal', children }) {
  return (
    <span className={`pill pill-${tone}`}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" strokeDasharray={tone === 'offline' ? '2 2.2' : undefined} />
        {ICONS[tone] && <path d={ICONS[tone]} />}
      </svg>
      {children}
    </span>
  )
}

// One word for a device's condition, from its live state.
export function deviceStatus(s) {
  if (!s) return { tone: 'offline', label: 'Unknown' }
  if (s.dim) return { tone: 'offline', label: s.label === 'NO DATA' ? 'No data' : 'Offline' }
  if (s.alarm === 'critical') return { tone: 'critical', label: 'Critical' }
  if (s.alarm === 'warning') return { tone: 'warning', label: 'Warning' }
  return { tone: 'normal', label: 'Normal' }
}

// The worst condition among several devices.
export function groupStatus(states) {
  if (!states.length) return { tone: 'offline', label: 'No devices' }
  const all = states.map(deviceStatus)
  for (const tone of ['critical', 'warning']) {
    const hit = all.find((x) => x.tone === tone)
    if (hit) return hit
  }
  return all.every((x) => x.tone === 'offline') ? { tone: 'offline', label: 'Offline' } : { tone: 'normal', label: 'Normal' }
}

export const DeviceStatusPill = ({ s }) => {
  const st = deviceStatus(s)
  return <Pill tone={st.tone}>{st.label}</Pill>
}

// "On" / "Off" from the profile's running rule, plus whether the values are current.
export function RunPills({ s }) {
  if (!s) return null
  const run = s.label === 'RUNNING' ? <Pill tone={s.alarm ? 'warning' : 'normal'}>On</Pill>
    : s.label === 'STOPPED' ? <Pill tone="offline">Off</Pill>
    : s.label === 'ALARM' ? <Pill tone="critical">Alarm</Pill>
    : null
  return (
    <span className="pill-row">
      {run}
      {s.dim ? <Pill tone="offline">{s.points.length ? 'Stale data' : 'No data'}</Pill> : <Pill tone="info">Current data</Pill>}
    </span>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'active' : ''}
          onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  )
}

export const Records = ({ n }) => <p className="records">{n} record{n === 1 ? '' : 's'}</p>

export const Tile = ({ label, children }) => (
  <div className="tile"><div className="tile-label">{label}</div><div className="tile-value">{children}</div></div>
)

export const pointValue = (p) => (
  p.value === null || p.value === undefined ? '—' : `${formatValue(Number(p.value))}${p.unit ? ` ${p.unit}` : ''}`
)

// A device's headline values: the profile's readouts first, then its measurements.
export function ValueTiles({ s, max = 4 }) {
  if (!s?.points.length) return null
  const chosen = s.readouts.map((r) => r.point).filter(Boolean)
  const rest = s.points.filter((p) => !chosen.includes(p) && p.kind === 'measure')
  return (
    <div className="tiles">
      {[...chosen, ...rest].slice(0, max).map((p) => <Tile key={p.key} label={p.key}>{s.dim ? '—' : pointValue(p)}</Tile>)}
    </div>
  )
}

// --- Alerts ------------------------------------------------------------------------------

// Conditions that are true right now. Nothing is stored yet, so there is no history and
// nothing to acknowledge: an alert is listed for as long as its condition holds.
export function currentAlerts(states) {
  return states.flatMap((s) => {
    const source = s.device.name
    if (s.label === 'OFFLINE') {
      return [{ id: `${s.device.id}:offline`, time: s.newest, alert: `${source} offline`, source, severity: 'offline',
        message: `Gateway ${s.device.gateway_key} is offline; values are not arriving.` }]
    }
    if (s.dim) return []
    return [
      ...s.alarms.map((key) => ({ id: `${s.device.id}:${key}`, time: s.values[key].time, alert: `${source} ${key}`, source,
        severity: 'critical', message: `${key} is active.` })),
      ...s.outOfRange.map((key) => ({ id: `${s.device.id}:${key}:range`, time: s.values[key].time, alert: `${source} ${key}`, source,
        severity: 'warning', message: `${key} is outside its range (${pointValue(s.values[key])}).` })),
    ]
  })
}

const SEVERITY = { critical: 'Critical', warning: 'Warning', offline: 'Offline' }

export function AlertsPanel({ states }) {
  const alerts = currentAlerts(states)
  return (
    <>
      <p className="note">
        Alerts are conditions that need attention right now: an active alarm point, a value outside its range, or a
        device whose gateway is offline. They are worked out from live values, so an alert disappears when its
        condition clears. Alert history, Acknowledge, Silence and Clear are not available yet.
      </p>
      <div className="list-panel table-scroll">
        <table>
          <thead><tr><th>Last value</th><th>Alert</th><th>Source</th><th>Message</th><th>Severity</th><th>State</th><th>Actions</th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="nowrap">{a.time ? new Date(a.time).toLocaleString() : '—'}</td>
                <td>{a.alert}</td>
                <td>{a.source}</td>
                <td>{a.message}</td>
                <td><Pill tone={a.severity}>{SEVERITY[a.severity]}</Pill></td>
                <td><Pill tone="warning">Active</Pill></td>
                <td className="nowrap">
                  <button className="small primary" disabled title={NOT_YET}>Acknowledge</button>{' '}
                  <button className="small" disabled title={NOT_YET}>Silence</button>{' '}
                  <button className="small" disabled title={NOT_YET}>Clear</button>
                </td>
              </tr>
            ))}
            {!alerts.length && <tr><td colSpan={7} className="sub">No active alerts.</td></tr>}
          </tbody>
        </table>
      </div>
      <Records n={alerts.length} />
    </>
  )
}

// --- Events ------------------------------------------------------------------------------

// The only occurrences recorded today are birth certificates: a device announcing itself,
// and the decision made about it.
export function EventsPanel({ devices }) {
  const certs = useLoad(() => api.certificates(''))
  const ids = new Set(devices.map((d) => d.id))
  const keys = new Set(devices.map((d) => d.device_key))
  const nameOf = (c) => devices.find((d) => d.id === c.device_id || d.device_key === c.device_key)?.name ?? c.device_key

  const events = (certs.data ?? [])
    .filter((c) => ids.has(c.device_id) || keys.has(c.device_key))
    .flatMap((c) => [
      { id: `${c.id}:r`, time: c.received_at, source: nameOf(c), href: `#/certificates/${c.id}`,
        text: `Announced itself through gateway ${c.gateway_key ?? '—'} with ${c.field_count} fields (birth certificate received).` },
      ...(c.decided_at ? [{ id: `${c.id}:d`, time: c.decided_at, source: nameOf(c), href: `#/certificates/${c.id}`,
        text: c.status === 'accepted'
          ? `Birth certificate accepted${c.auto_accepted ? ' automatically: its type matched a profile' : ''}.`
          : 'Birth certificate declined.' }] : []),
    ])
    .sort((a, b) => new Date(b.time) - new Date(a.time))

  return (
    <>
      <p className="note">
        Events are recorded occurrences. Today that means birth certificates: a device announcing itself and the
        decision made about it. Equipment starts, stops and state changes are not recorded yet.
      </p>
      <Errors errors={[certs.error]} />
      <div className="list-panel table-scroll">
        <table>
          <thead><tr><th>Occurred</th><th>Source</th><th>Event</th><th>Severity</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{new Date(e.time).toLocaleString()}</td>
                <td>{e.source}</td>
                <td><a className="plain-link" href={e.href}>{e.text}</a></td>
                <td><Pill tone="info">Info</Pill></td>
              </tr>
            ))}
            {certs.data && !events.length && <tr><td colSpan={4} className="sub">No events recorded.</td></tr>}
          </tbody>
        </table>
      </div>
      <Records n={events.length} />
    </>
  )
}

// --- Documents ---------------------------------------------------------------------------

export function DocumentsPanel({ name }) {
  return (
    <>
      <div className="section-head">
        <div><h2>Documents</h2><p className="page-sub">Files associated with {name}.</p></div>
        <button className="primary" disabled title={NOT_YET}>Upload</button>
      </div>
      <div className="list-panel table-scroll">
        <table>
          <thead><tr><th>Type</th><th>Title</th><th>Date</th><th>Description</th><th>Filename</th><th>Actions</th></tr></thead>
          <tbody><tr><td colSpan={6} className="sub">Documents can't be stored in this prototype yet.</td></tr></tbody>
        </table>
      </div>
      <Records n={0} />
    </>
  )
}
