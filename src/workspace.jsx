import { useEffect } from 'react'
import { api } from './api.js'
import { useLoad, useAction } from './lib.js'
import { Errors } from './ui.jsx'
import { formatValue } from './charts/format.js'

export const NOT_YET = 'Not available in this prototype yet'

const ICONS = {
  normal: 'M5.2 8.2l2 2 3.6-4',
  warning: 'M8 4.6v4.2M8 11.2v.2',
  critical: 'M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4',
  info: 'M8 7.4v3.8M8 4.8v.2',
}

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

export function deviceStatus(s) {
  if (!s) return { tone: 'offline', label: 'Unknown' }
  if (s.dim) return { tone: 'offline', label: s.label === 'NO DATA' ? 'No data' : 'Offline' }
  if (s.alarm === 'critical') return { tone: 'critical', label: 'Critical' }
  if (s.alarm === 'warning') return { tone: 'warning', label: 'Warning' }
  return { tone: 'normal', label: 'Normal' }
}

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

const SEVERITY = { critical: 'Critical', warning: 'Warning', offline: 'Offline', info: 'Info' }
const when = (t) => new Date(t).toLocaleString()

function AlertState({ a }) {
  if (a.state === 'resolved') {
    return (
      <>
        <Pill tone="offline">{a.resolved_by ? 'Cleared' : 'Resolved'}</Pill>
        <div className="sub">{a.resolved_by ? `by ${a.resolved_by}, ` : ''}{when(a.resolved_at)}</div>
      </>
    )
  }
  return (
    <>
      {a.state === 'acknowledged' ? <Pill tone="info">Acknowledged</Pill> : <Pill tone="warning">Active</Pill>}
      {a.silenced && <> <Pill tone="offline">Silenced</Pill></>}
      {a.state === 'acknowledged' && <div className="sub">by {a.acknowledged_by}, {when(a.acknowledged_at)}</div>}
      {a.silenced && <div className="sub">until {when(a.silenced_until)}</div>}
    </>
  )
}

export function AlertsPanel({ scope }) {
  const alerts = useLoad(() => api.alerts(scope), [scope.device_id, scope.system_id])
  const action = useAction()
  const { reload } = alerts
  useEffect(() => {
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [reload])

  const run = (fn) => async () => { if (await action.run(fn)) reload() }
  const clear = (a) => async () => {
    if (!window.confirm(`Clear "${a.title}"? If its condition still holds, it is raised again with the next value.`)) return
    if (await action.run(() => api.clearAlert(a.id))) reload()
  }
  const rows = alerts.data ?? []

  return (
    <>
      <p className="note">
        Alerts are conditions that need attention: an active alarm point, a value outside its range, or a device
        whose gateway is offline. An alert resolves on its own when its condition clears. Acknowledge records that
        someone has seen it, Silence marks it as quiet for an hour, and Clear closes it by hand.
      </p>
      <Errors errors={[alerts.error, action.error]} />
      <div className="list-panel table-scroll">
        <table>
          <thead><tr><th>Created</th><th>Alert</th><th>Source</th><th>Message</th><th>Severity</th><th>State</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="nowrap">{when(a.raised_at)}</td>
                <td>{a.title}</td>
                <td><a className="plain-link" href={`#/devices/${a.device_id}`}>{a.device_name}</a></td>
                <td>{a.message}</td>
                <td><Pill tone={a.severity}>{SEVERITY[a.severity]}</Pill></td>
                <td><AlertState a={a} /></td>
                <td className="nowrap">
                  {a.state === 'resolved' ? '—' : (
                    <>
                      {a.state === 'active' && <><button className="small primary" onClick={run(() => api.acknowledgeAlert(a.id))}>Acknowledge</button>{' '}</>}
                      {!a.silenced && <><button className="small" onClick={run(() => api.silenceAlert(a.id))}>Silence</button>{' '}</>}
                      <button className="small success" onClick={clear(a)}>Clear</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {alerts.data && !rows.length && <tr><td colSpan={7} className="sub">No alerts have been raised.</td></tr>}
          </tbody>
        </table>
      </div>
      <Records n={rows.length} />
    </>
  )
}

export function EventsPanel({ scope, devices }) {
  const stored = useLoad(() => api.events(scope), [scope.device_id, scope.system_id])
  const certs = useLoad(() => api.certificates(''))
  const ids = new Set(devices.map((d) => d.id))
  const keys = new Set(devices.map((d) => d.device_key))
  const nameOf = (c) => devices.find((d) => d.id === c.device_id || d.device_key === c.device_key)?.name ?? c.device_key

  const fromCertificates = (certs.data ?? [])
    .filter((c) => ids.has(c.device_id) || keys.has(c.device_key))
    .flatMap((c) => [
      { id: `c${c.id}:r`, time: c.received_at, source: nameOf(c), href: `#/certificates/${c.id}`, severity: 'info',
        text: `Announced itself through gateway ${c.gateway_key ?? '—'} with ${c.field_count} fields (birth certificate received).` },
      ...(c.decided_at ? [{ id: `c${c.id}:d`, time: c.decided_at, source: nameOf(c), href: `#/certificates/${c.id}`, severity: 'info',
        text: c.status === 'accepted'
          ? `Birth certificate accepted${c.auto_accepted ? ' automatically: its type matched a profile' : ''}.`
          : 'Birth certificate declined.' }] : []),
    ])
  const fromLog = (stored.data ?? []).map((e) => ({
    id: `e${e.id}`, time: e.occurred_at, source: e.device_name ?? e.gateway_key ?? '—', severity: e.severity, text: e.message,
  }))
  const events = [...fromLog, ...fromCertificates].sort((a, b) => new Date(b.time) - new Date(a.time))

  return (
    <>
      <p className="note">
        Events are recorded occurrences: equipment starting and stopping, gateways going offline and coming back,
        alerts being raised, acknowledged, silenced and resolved, and devices announcing themselves. They describe
        what happened and are never edited.
      </p>
      <Errors errors={[stored.error, certs.error]} />
      <div className="list-panel table-scroll">
        <table>
          <thead><tr><th>Occurred</th><th>Source</th><th>Event</th><th>Severity</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{when(e.time)}</td>
                <td>{e.source}</td>
                <td>{e.href ? <a className="plain-link" href={e.href}>{e.text}</a> : e.text}</td>
                <td><Pill tone={SEVERITY[e.severity] ? e.severity : 'info'}>{SEVERITY[e.severity] ?? 'Info'}</Pill></td>
              </tr>
            ))}
            {stored.data && certs.data && !events.length && <tr><td colSpan={4} className="sub">No events recorded.</td></tr>}
          </tbody>
        </table>
      </div>
      <Records n={events.length} />
    </>
  )
}

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
