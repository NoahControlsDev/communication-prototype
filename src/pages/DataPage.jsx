import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction, ago, until, show } from '../lib.js'
import { PageHeader, Card, Errors, Empty, Badge } from '../ui.jsx'
import RangePicker from '../charts/RangePicker.jsx'
import StatTile from '../charts/StatTile.jsx'
import IngestionChart from '../charts/IngestionChart.jsx'
import SmallMultiples from '../charts/SmallMultiples.jsx'
import { formatCount } from '../charts/format.js'

const REASONS = {
  unknown_device:   { label: 'unknown device',   tone: 'warn',    hint: 'No device with this key yet: review its birth certificate.' },
  gateway_mismatch: { label: 'wrong gateway',    tone: 'danger',  hint: 'The device is registered under a different gateway.' },
  unknown_property: { label: 'unknown property', tone: 'warn',    hint: 'Not on the device: add it to the profile (then sync) or as an extension.' },
  awaiting_review:  { label: 'awaiting review',  tone: 'info',    hint: 'An extension on the device that isn’t approved yet.' },
  not_numeric:      { label: 'not numeric',      tone: 'neutral', hint: 'Can’t be stored as a reading (text or object value).' },
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

const TABS = ['system', 'held', 'declined']

// The tab lives in the URL (#/data/held) so a refresh keeps it.
export default function DataPage({ tab: urlTab }) {
  const tab = TABS.includes(urlTab) ? urlTab : 'system'
  const setTab = (t) => { window.location.hash = `#/data/${t}` }
  const [query, setQuery] = useState('')
  const [auto, setAuto] = useState(false)
  const [range, setRange] = useState('1h')
  const [tick, setTick] = useState(0) // bumps on refresh so open small multiples refetch too
  const latest = useLoad(api.dataLatest)
  const held = useLoad(api.dataUnapproved)
  const stats = useLoad(() => api.dataStats(range), [range])
  const gateways = useLoad(() => api.list('gateways'))
  const declined = useLoad(api.dataDeclined)

  const { reload: reloadLatest } = latest
  const { reload: reloadHeld } = held
  const { reload: reloadStats } = stats
  const { reload: reloadGateways } = gateways
  const { reload: reloadDeclined } = declined
  const reloadAll = useMemo(() => () => {
    reloadLatest(); reloadHeld(); reloadStats(); reloadGateways(); reloadDeclined(); setTick((t) => t + 1)
  }, [reloadLatest, reloadHeld, reloadStats, reloadGateways, reloadDeclined])
  // Optional live refresh every 10 s.
  useEffect(() => {
    if (!auto) return undefined
    const t = setInterval(reloadAll, 10_000)
    return () => clearInterval(t)
  }, [auto, reloadAll])

  const heldRows = held.data?.points ?? []
  const retention = held.data?.retention_hours ?? 24
  const heldPoints = heldRows.length
  const heldValues = heldRows.reduce((n, h) => n + h.count, 0)
  const declinedCount = (declined.data?.rules.length ?? 0) + (declined.data?.certificates.length ?? 0)
  const outOfRange = latest.data?.filter((l) => l.quality === 2).length ?? 0
  const lastHour = stats.data?.buckets.reduce((n, b) => n + b.stored, 0) ?? 0
  const gwKnown = gateways.data?.filter((g) => g.status) ?? []
  const gwOnline = gwKnown.filter((g) => g.status === 'online').length
  const rangeLabel = { '15m': '15 min', '1h': 'hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days' }[range]

  return (
    <>
      <PageHeader title="Data" subtitle="Values arriving from gateways, and where each one ends up.">
        <label className="inline-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh</label>
        <button onClick={reloadAll}>Refresh</button>
      </PageHeader>
      <Errors errors={[latest.error, held.error, stats.error, gateways.error, declined.error]} />

      {/* One filter row: the range scopes the ingestion chart and every device chart below. */}
      <div className="filter-row">
        <RangePicker value={range} onChange={setRange} />
      </div>

      <div className="stat-row">
        <StatTile label="Points in the system" value={formatCount(latest.data?.length ?? 0)} note="with at least one reading" />
        <StatTile label={`Readings stored, last ${rangeLabel}`} value={formatCount(lastHour)} />
        <StatTile label="Values held" value={formatCount(heldValues)}
          note={`on ${plural(heldPoints, 'point')} · deleted after ${retention} h`} />
        <StatTile label="Out of range now" value={formatCount(outOfRange)}
          status={outOfRange ? 'critical' : 'good'} note={outOfRange ? 'latest value outside its range' : 'all within range'} />
        <StatTile label="Gateways online" value={`${gwOnline} / ${gwKnown.length}`}
          status={gwKnown.length && gwOnline < gwKnown.length ? 'critical' : gwKnown.length ? 'good' : undefined}
          note={gwKnown.length - gwOnline ? `${gwKnown.length - gwOnline} offline` : gwKnown.length ? 'all connected' : 'none reporting status'} />
      </div>

      <Card title="Values arriving">
        {stats.data && <IngestionChart stats={stats.data} range={range} />}
      </Card>

      <div className="tabs">
        <button className={tab === 'system' ? 'active' : ''} onClick={() => setTab('system')}
          title="Saved permanently">
          Accepted {latest.data && <Badge tone="ok">{latest.data.length}</Badge>}
        </button>
        <button className={tab === 'held' ? 'active' : ''} onClick={() => setTab('held')}
          title={`Kept for ${retention} hours, then deleted unless approved`}>
          Not approved {heldPoints > 0 && <Badge tone="warn">{heldPoints}</Badge>}
        </button>
        <button className={tab === 'declined' ? 'active' : ''} onClick={() => setTab('declined')}
          title="Not saved at all">
          Declined {declinedCount > 0 && <Badge>{declinedCount}</Badge>}
        </button>
      </div>

      <Card>
        <div className="toolbar">
          <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gateway, device or property…" />
          {tab === 'held' && heldValues > 0 && <span className="sub">{plural(heldValues, 'value')} held</span>}
        </div>
        {tab === 'system' && latest.data && <InSystem rows={latest.data} query={query} range={range} tick={tick} />}
        {tab === 'held' && held.data && <NotApproved rows={heldRows} retention={retention} query={query} onChanged={reloadAll} />}
        {tab === 'declined' && declined.data && <Declined data={declined.data} query={query} onChanged={reloadAll} />}
      </Card>
    </>
  )
}

const matches = (q, ...values) => !q || values.some((v) => v?.toLowerCase().includes(q))

// gateway → device → rows, preserving order
function groupRows(rows, deviceKeyOf = (r) => r.device_key) {
  const gateways = new Map()
  for (const r of rows) {
    if (!gateways.has(r.gateway_key)) gateways.set(r.gateway_key, new Map())
    const devices = gateways.get(r.gateway_key)
    const key = deviceKeyOf(r)
    if (!devices.has(key)) devices.set(key, [])
    devices.get(key).push(r)
  }
  return gateways
}

function Collapsible({ head, children, defaultOpen = false, depth = 0 }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={depth === 0 ? 'group card-flat top-gap' : 'group'}>
      <div className="group-head" style={{ paddingLeft: 8 + depth * 22 }}>
        <button className="chevron" onClick={() => setOpen((o) => !o)}>{open ? '▾' : '▸'}</button>
        {head(() => setOpen((o) => !o))}
      </div>
      {open && children}
    </div>
  )
}

// ------------------------------------------------------------------ in the system

function InSystem({ rows, query, range, tick }) {
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => rows.filter((r) => matches(q, r.gateway_key, r.device_key, r.device_name, r.key)),
    [rows, q],
  )
  if (!rows.length) return <Empty>No readings stored yet. Approved devices’ data appears here as it arrives.</Empty>
  if (!filtered.length) return <Empty>Nothing matches that search.</Empty>

  return [...groupRows(filtered)].map(([gateway, devices]) => {
    const first = [...devices.values()][0][0]
    return (
      <Collapsible key={gateway + q} defaultOpen head={(toggle) => (
        <>
          <button className="group-label" onClick={toggle}>{gateway}</button>
          <Badge tone={first.gateway_status === 'online' ? 'ok' : first.gateway_status === 'offline' ? 'danger' : 'neutral'}>
            {first.gateway_status ?? 'no status'}
          </Badge>
          <Badge>{plural(devices.size, 'device')}</Badge>
        </>
      )}>
        {[...devices].map(([deviceKey, points]) => {
          const out = points.filter((p) => p.quality === 2).length
          const newest = points.reduce((a, p) => (p.time > a ? p.time : a), points[0].time)
          return (
            <DeviceBlock key={deviceKey + q} deviceKey={deviceKey} points={points} q={q} out={out} newest={newest}
              range={range} tick={tick} />
          )
        })}
      </Collapsible>
    )
  })
}

function DeviceBlock({ deviceKey, points, q, out, newest, range, tick }) {
  const [view, setView] = useState('table')
  return (
    <Collapsible depth={1} defaultOpen={Boolean(q)} head={(toggle) => (
      <>
        <button className="group-label" onClick={toggle}>{points[0].device_name}</button>
        <span className="sub">{deviceKey}</span>
        <Badge>{plural(points.length, 'point')}</Badge>
        {out > 0 && <Badge tone="danger">{out} out of range</Badge>}
        <span className="spacer" />
        <span className="sub">updated {ago(newest)}</span>
        <div className="segmented small-seg">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
          <button className={view === 'charts' ? 'active' : ''} onClick={() => setView('charts')}>Charts</button>
        </div>
        <a className="small-link" href={`#/devices/${points[0].device_id}`}>Open device →</a>
      </>
    )}>
      {view === 'charts' && <SmallMultiples deviceId={points[0].device_id} range={range} refresh={tick} />}
      {view === 'table' && <div className="table-scroll">
        <table className="compact indent">
          <thead><tr><th>Property</th><th>Value</th><th>Quality</th><th>At</th><th>Stored</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.device_property_id}>
                <td><strong>{p.key}</strong></td>
                <td>{show(p.value)}{p.unit && <span className="sub"> {p.unit}</span>}</td>
                <td>{p.quality === 2 ? <Badge tone="danger">out of range</Badge> : p.quality === 0 ? <Badge tone="ok">good</Badge> : '—'}</td>
                <td className="sub" title={new Date(p.time).toLocaleString()}>{ago(p.time)}</td>
                <td className="sub">{p.reading_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </Collapsible>
  )
}

// ------------------------------------------------------------------ not approved

function NotApproved({ rows, retention, query, onChanged }) {
  const action = useAction()
  const [note, setNote] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => rows.filter((r) => matches(q, r.gateway_key, r.device_key, r.key, REASONS[r.reason]?.label)),
    [rows, q],
  )

  const clear = async (filters, what) => {
    if (!window.confirm(`Delete the held values for ${what}? New data will still be held as it arrives.`)) return
    if (await action.run(() => api.deleteUnapproved(filters))) onChanged()
  }
  const decline = async (rule, what) => {
    if (!window.confirm(`Decline ${what}? Its held values are deleted now and new values won't be saved. You can undo this on the Declined tab.`)) return
    if (await action.run(() => api.declineData(rule))) onChanged()
  }
  const recheck = () => action.run(async () => {
    const { promoted } = await api.promoteData()
    setNote(promoted ? `Moved ${promoted} held values into readings.` : 'Nothing to move: everything held is still unapproved.')
    onChanged()
  })

  const banner = (
    <p className="retention-note top-gap">
      <span className="status-icon">⚠</span> Not approved values are kept for <strong>{retention} hours</strong>, then
      deleted automatically. Accept the device or approve the property to keep them, or decline it to stop saving it.
    </p>
  )
  if (!rows.length) return <>{banner}<Empty>Nothing held: every value that arrived belongs to an approved device and property.</Empty></>

  const byReason = rows.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] ?? 0) + 1 }), {})

  return (
    <>
      {banner}
      <div className="reason-summary top-gap">
        {Object.entries(byReason).map(([reason, n]) => (
          <span key={reason} title={REASONS[reason]?.hint}><Badge tone={REASONS[reason]?.tone}>{REASONS[reason]?.label}</Badge> {n}</span>
        ))}
        <span className="spacer" />
        <button className="small" onClick={recheck} title="Move held values whose device and property are now approved">Re-check approvals</button>
        <button className="small danger" onClick={() => clear({}, 'everything')}>Clear all held</button>
      </div>
      <Errors errors={[action.error]} />
      {note && <p className="hint">{note}</p>}
      {!filtered.length && <Empty>Nothing matches that search.</Empty>}

      {[...groupRows(filtered)].map(([gateway, devices]) => (
        <Collapsible key={gateway + q} defaultOpen head={(toggle) => (
          <>
            <button className="group-label" onClick={toggle}>{gateway}</button>
            <Badge>{plural(devices.size, 'device')}</Badge>
            <span className="spacer" />
            <button className="small danger" onClick={() => clear({ gateway_key: gateway }, `gateway ${gateway}`)}>Clear</button>
          </>
        )}>
          {[...devices].map(([deviceKey, points]) => {
            const reasons = [...new Set(points.map((p) => p.reason))]
            const deviceId = points.find((p) => p.device_id)?.device_id
            const count = points.reduce((n, p) => n + p.count, 0)
            const firstExpiry = points.reduce((a, p) => (p.expires_at < a ? p.expires_at : a), points[0].expires_at)
            return (
              <Collapsible key={deviceKey + q} depth={1} defaultOpen={Boolean(q)} head={(toggle) => (
                <>
                  <button className="group-label" onClick={toggle}>{deviceKey}</button>
                  {reasons.map((r) => <Badge key={r} tone={REASONS[r]?.tone}>{REASONS[r]?.label}</Badge>)}
                  <span className="sub">{plural(points.length, 'point')} · {plural(count, 'value')}</span>
                  <span className="spacer" />
                  <span className="expiry" title={new Date(firstExpiry).toLocaleString()}>deleting {until(firstExpiry)}</span>
                  {reasons.includes('unknown_device')
                    ? <a className="small-link" href="#/certificates">Birth certificates →</a>
                    : deviceId && <a className="small-link" href={`#/devices/${deviceId}`}>Open device →</a>}
                  <button className="small danger" onClick={() => decline({ gateway_key: gateway, device_key: deviceKey }, `the whole device ${deviceKey}`)}>Decline device</button>
                </>
              )}>
                <div className="table-scroll">
                  <table className="compact indent">
                    <thead><tr><th>Property</th><th>Why</th><th>Latest value</th><th>Values</th><th>First</th><th>Last</th><th>Deleted</th><th /></tr></thead>
                    <tbody>
                      {points.map((p) => (
                        <tr key={p.key + p.reason}>
                          <td><strong>{p.key}</strong></td>
                          <td title={REASONS[p.reason]?.hint}><Badge tone={REASONS[p.reason]?.tone}>{REASONS[p.reason]?.label}</Badge></td>
                          <td>{JSON.stringify(p.last_value)}</td>
                          <td className="sub">{p.count}</td>
                          <td className="sub" title={new Date(p.first_time).toLocaleString()}>{ago(p.first_time)}</td>
                          <td className="sub" title={new Date(p.last_time).toLocaleString()}>{ago(p.last_time)}</td>
                          <td className="expiry" title={`Oldest value deleted ${new Date(p.expires_at).toLocaleString()}`}>{until(p.expires_at)}</td>
                          <td className="row-actions">
                            <button className="small danger" onClick={() => decline({ gateway_key: gateway, device_key: deviceKey, key: p.key }, `${deviceKey} · ${p.key}`)}>Decline</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Collapsible>
            )
          })}
        </Collapsible>
      ))}
    </>
  )
}

// ------------------------------------------------------------------ declined

function Declined({ data, query, onChanged }) {
  const action = useAction()
  const q = query.trim().toLowerCase()
  const rules = data.rules.filter((r) => matches(q, r.gateway_key, r.device_key, r.key))
  const certs = data.certificates.filter((c) => matches(q, c.gateway_key, c.device_key))

  const undo = async (rule) => {
    if (await action.run(() => api.undeclineData(rule.id))) onChanged()
  }

  return (
    <>
      <p className="hint top-gap">
        Values from anything listed here are dropped as they arrive: not saved at all. Undo a decline and new values
        are held again (or saved, once approved).
      </p>
      <Errors errors={[action.error]} />
      {!data.rules.length && !data.certificates.length && <Empty>Nothing declined.</Empty>}

      {rules.length > 0 && (
        <div className="table-scroll top-gap">
          <table className="compact">
            <thead><tr><th>Gateway</th><th>Device</th><th>Property</th><th>Declined</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.gateway_key}</td>
                  <td><strong>{r.device_key}</strong></td>
                  <td>{r.key ?? <Badge>whole device</Badge>}</td>
                  <td className="sub" title={new Date(r.created_at).toLocaleString()}>{ago(r.created_at)}</td>
                  <td className="row-actions"><button className="small" onClick={() => undo(r)}>Undo</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {certs.length > 0 && (
        <>
          <h3 className="label top-gap">Declined birth certificates</h3>
          <p className="hint">Undo these by reopening (or deleting) the certificate.</p>
          <div className="table-scroll">
            <table className="compact">
              <thead><tr><th>Gateway</th><th>Device</th><th>Declined</th><th /></tr></thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id}>
                    <td>{c.gateway_key}</td>
                    <td><strong>{c.device_key}</strong></td>
                    <td className="sub">{c.decided_at ? ago(c.decided_at) : '—'}</td>
                    <td className="row-actions"><a className="small-link" href={`#/certificates/${c.id}`}>Open certificate →</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
