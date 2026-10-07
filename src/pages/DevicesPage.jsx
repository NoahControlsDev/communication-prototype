import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction, go, profileName, show, ago } from '../lib.js'
import { PageHeader, Card, Errors, Empty, Badge, StatusBadge, GatewayDot } from '../ui.jsx'
import { useLive } from '../live.js'
import {
  Pill, DeviceStatusPill, RunPills, Tabs, Records, ValueTiles, pointValue,
  AlertsPanel, EventsPanel, DocumentsPanel,
} from '../workspace.jsx'
import Sparkline from '../charts/Sparkline.jsx'
import PropertyHistory from '../charts/PropertyHistory.jsx'
import RangePicker from '../charts/RangePicker.jsx'
import SmallMultiples from '../charts/SmallMultiples.jsx'

export default function DevicesPage({ id, tab }) {
  return id ? <DeviceDetail id={id} tab={tab} /> : <DeviceList />
}

const numOrBlank = (v) => (v === null || v === undefined ? '' : String(v))
const typeOf = (d) => `${d.profile_key}@${d.profile_major}.${d.profile_minor}`

const COLUMNS = [
  { key: 'name', label: 'Device', value: (d) => d.name },
  { key: 'gateway', label: 'Gateway', value: (d) => d.gateway_key },
  { key: 'system', label: 'System', value: (d) => d.system_name ?? '' },
  { key: 'type', label: 'Type', value: typeOf },
  { key: 'site_tag', label: 'Site tag', value: (d) => d.site_tag ?? '' },
]

function DeviceList() {
  const live = useLive()
  const profiles = useLoad(api.profiles)
  const gateways = useLoad(() => api.list('gateways'))
  const action = useAction()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ device_key: '', name: '', site_tag: '', gateway_id: '', profile_id: '' })
  const [sort, setSort] = useState({ key: 'system', dir: 1 })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = (e) => {
    e.preventDefault()
    action.run(async () => {
      const d = await api.createDevice(form)
      go(`#/devices/${d.id}/configuration`)
    })
  }

  const missing = profiles.data?.length === 0 ? 'a profile' : gateways.data?.length === 0 ? 'a gateway' : null
  const column = COLUMNS.find((c) => c.key === sort.key)
  const rows = [...live.devices].sort((a, b) =>
    sort.dir * column.value(a).localeCompare(column.value(b), undefined, { numeric: true }) || a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader title="All Devices" current="Devices" subtitle="View all devices grouped by system.">
        {!adding && <button className="primary" onClick={() => setAdding(true)}>Add Device</button>}
      </PageHeader>
      <Errors errors={[...live.errors, profiles.error, gateways.error, action.error]} />

      {adding && (
        <Card title="Add device">
          {missing ? (
            <Empty>Create {missing} first — every device needs a profile and a gateway.</Empty>
          ) : (
            <form className="form-grid" onSubmit={create}>
              <label>Device key *<input value={form.device_key} onChange={set('device_key')} required placeholder="stable key from the gateway" /></label>
              <label>Name *<input value={form.name} onChange={set('name')} required placeholder="e.g. Pump 9A" /></label>
              <label>Site tag<input value={form.site_tag} onChange={set('site_tag')} placeholder="e.g. P09A" /></label>
              <label>Gateway *
                <select value={form.gateway_id} onChange={set('gateway_id')} required>
                  <option value="">Choose…</option>
                  {gateways.data?.map((g) => <option key={g.id} value={g.id}>{g.gateway_key}</option>)}
                </select>
              </label>
              <label>Profile *
                <select value={form.profile_id} onChange={set('profile_id')} required>
                  <option value="">Choose…</option>
                  {profiles.data?.map((p) => <option key={p.id} value={p.id}>{profileName(p)}</option>)}
                </select>
              </label>
              <p className="hint span-all">Devices normally arrive on their own through a birth certificate. One added here starts unplaced, with the fields of its profile.</p>
              <div className="form-actions span-all">
                <button className="primary">Add device</button>
                <button type="button" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          )}
        </Card>
      )}

      <div className="list-panel table-scroll">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                  <button className="th-sort" onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? -sort.dir : 1 })}>
                    {c.label}<span aria-hidden="true">{sort.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
              ))}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <a className="row-link" href={`#/devices/${d.id}`}>{d.name}</a>
                  {d.awaiting_review > 0 && <> <Badge tone="warn">{d.awaiting_review} to review</Badge></>}
                </td>
                <td>{d.gateway_key}</td>
                <td>{d.system_id ? <a className="plain-link" href={`#/systems/${d.system_id}`}>{d.system_name}</a> : <span className="sub">not placed</span>}</td>
                <td>{typeOf(d)}</td>
                <td>{show(d.site_tag)}</td>
                <td>{live.loaded && <DeviceStatusPill s={live.states.get(d.id)} />}</td>
              </tr>
            ))}
            {live.loaded && !rows.length && <tr><td colSpan={6} className="sub">No devices yet. They appear once a gateway's birth certificate is accepted.</td></tr>}
          </tbody>
        </table>
      </div>
      <Records n={rows.length} />
    </>
  )
}

const DEVICE_TABS = ['Overview', 'Status', 'Configuration', 'Analytics', 'Alerts', 'Events', 'Documents']
  .map((label) => ({ id: label.toLowerCase(), label }))

function DeviceDetail({ id, tab }) {
  const current = DEVICE_TABS.some((t) => t.id === tab) ? tab : 'overview'
  const setTab = (t) => go(`#/devices/${id}${t === 'overview' ? '' : `/${t}`}`)
  const device = useLoad(() => api.device(id), [id])
  const gateways = useLoad(() => api.list('gateways'))
  const systems = useLoad(() => api.list('systems'))
  const live = useLive()
  const action = useAction()
  const d = device.data
  const s = live.states.get(id)

  const { reload } = device
  useEffect(() => {
    if (current === 'configuration') return undefined
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [current, reload])

  const update = (body) => action.run(async () => { await api.updateDevice(id, body); device.reload() })

  const remove = async () => {
    if (!window.confirm(`Delete ${d.name}? Its properties and readings are deleted too.`)) return
    if (await action.run(() => api.deleteDevice(id))) go('#/devices')
  }

  if (!d) return <Errors errors={[device.error]} />

  const crumbs = [
    ...(d.system_id ? [{ label: 'Systems', href: '#/systems' }, { label: d.system_name, href: `#/systems/${d.system_id}` }] : []),
    { label: 'Devices', href: '#/devices' },
    ...(current === 'overview' ? [] : [{ label: d.name, href: `#/devices/${id}` }]),
  ]
  const gateway = gateways.data?.find((g) => g.id === d.gateway_id)

  return (
    <>
      <PageHeader title={d.name} subtitle="Device operational workspace" crumbs={crumbs}
        current={current === 'overview' ? d.name : DEVICE_TABS.find((t) => t.id === current).label}>
        {current !== 'configuration' && <button className="primary" onClick={() => setTab('configuration')}>Edit Device</button>}
      </PageHeader>
      <Errors errors={[gateways.error, systems.error, action.error, ...live.errors]} />
      <Tabs tabs={DEVICE_TABS} value={current} onChange={setTab} />

      {current === 'overview' && (
        <div className="two-col">
          <Card>
            <dl className="stacked-facts">
              <dt>Device name</dt><dd>{d.name}</dd>
              <dt>Device type</dt><dd><a className="plain-link" href={`#/profiles/${d.profile_id}`}>{typeOf(d)}</a></dd>
              <dt>Site tag</dt><dd>{show(d.site_tag)}</dd>
              <dt>System</dt>
              <dd>{d.system_id
                ? <a className="plain-link" href={`#/systems/${d.system_id}`}>{d.system_name}</a>
                : <><StatusBadge status="pending" /> <button className="link" onClick={() => setTab('configuration')}>Commission it into a system</button></>}</dd>
              <dt>Gateway</dt><dd className="with-dot"><GatewayDot status={gateway?.status ?? null} />{d.gateway_key}</dd>
              <dt>Device key</dt><dd>{d.device_key}</dd>
              <dt>Points</dt><dd>{d.properties.length}</dd>
            </dl>
          </Card>
          <Card>
            <div className="panel-pills"><RunPills s={s} /></div>
            <ValueTiles s={s} max={6} />
            {s && !s.points.length && <p className="sub">No values have arrived for this device yet.</p>}
            <Controls device={d} gatewayOnline={gateway?.status === 'online'} onApplied={() => setTimeout(device.reload, 1200)} />
          </Card>
        </div>
      )}

      {current === 'status' && <StatusTab device={d} gateway={gateway} s={s} />}

      {current === 'configuration' && (
        <>
          <div className="two-col">
            <Card title="Details">
              <DeviceForm key={JSON.stringify([d.name, d.site_tag, d.device_key, d.gateway_id])} device={d} gateways={gateways.data ?? []} onSave={update} />
            </Card>
            <Card title="Commissioning">
              <Commissioning key={`${d.status}-${d.system_id}`} device={d} systems={systems.data ?? []} onSave={update} />
            </Card>
          </div>
          <DeviceProperties device={d} reload={device.reload} action={action} />
          <Card>
            <h2 className="danger-title">Delete device</h2>
            <p className="page-sub">Permanently remove this device, with its properties and every reading stored for it.</p>
            <button className="danger-solid top-gap" onClick={remove}>Delete device</button>
          </Card>
        </>
      )}

      {current === 'analytics' && <AnalyticsTab device={d} />}
      {current === 'alerts' && <AlertsPanel scope={{ device_id: id }} />}
      {current === 'events' && <EventsPanel scope={{ device_id: id }} devices={[d]} />}
      {current === 'documents' && <DocumentsPanel name={d.name} />}
    </>
  )
}

function Controls({ device, gatewayOnline, onApplied }) {
  const commands = useLoad(() => api.deviceCommands(device.id), [device.id])
  const { reload } = commands
  useEffect(() => {
    const t = setInterval(reload, 2000)
    return () => clearInterval(t)
  }, [reload])

  const writable = device.properties.filter((p) => p.is_standard && p.declared_writable && p.writable_override !== false && p.approved)
  if (!writable.length) return <p className="sub top-gap">No supported operational controls are available for this equipment.</p>

  return (
    <div className="controls">
      {!gatewayOnline && <p className="retention-note">Gateway {device.gateway_key} is offline, so commands can't be delivered right now.</p>}
      {writable.map((p) => (
        <Control key={p.id} p={p} disabled={!gatewayOnline}
          last={commands.data?.find((c) => c.device_property_id === p.id)}
          onSent={() => { reload(); onApplied() }} />
      ))}
    </div>
  )
}

function CommandStatus({ c }) {
  const what = `${c.key} = ${c.value}`
  if (c.status === 'sent') return <p className="command-status">Sent {what}, waiting for the gateway…</p>
  if (c.status === 'applied') return <p className="command-status ok">Applied {what} by {c.requested_by}, {ago(c.result_at)}</p>
  if (c.status === 'rejected') return <p className="command-status bad">Gateway rejected {what}: {c.reason}</p>
  if (c.status === 'timeout') return <p className="command-status bad">No answer from the gateway to {what}, {ago(c.result_at)}</p>
  return <p className="command-status bad">{what} was not sent: {c.reason}</p>
}

function Control({ p, last, disabled, onSent }) {
  const action = useAction()
  const [draft, setDraft] = useState(null)
  const current = numOrBlank(p.last_value)
  const value = draft ?? current
  const lo = p.min_override ?? p.declared_min
  const hi = p.max_override ?? p.declared_max
  const options = p.enum_map ? Object.entries(p.enum_map) : null

  const send = async (v) => {
    if (await action.run(() => api.sendCommand(p.id, Number(v)))) {
      setDraft(null)
      onSent()
    }
  }
  const submit = (e) => {
    e.preventDefault()
    if (value !== '') send(value)
  }
  const label = <>{p.key}{p.unit && <span className="sub"> ({p.unit})</span>}</>

  return (
    <div className="control">
      {p.type === 'bool' ? (
        <>
          <span className="control-label">{label}</span>
          <label className="switch-row">
            <input className="switch" type="checkbox" checked={Number(current) > 0} disabled={disabled}
              onChange={(e) => send(e.target.checked ? 1 : 0)} />
            {Number(current) > 0 ? 'On' : 'Off'}
          </label>
        </>
      ) : (
        <form onSubmit={submit}>
          <label className="control-label" htmlFor={`control-${p.id}`}>{label}</label>
          <div className="control-row">
            {options ? (
              <select id={`control-${p.id}`} value={value} disabled={disabled} onChange={(e) => setDraft(e.target.value)}>
                {!options.some(([k]) => k === String(value)) && <option value={value}>{value === '' ? 'Choose…' : value}</option>}
                {options.map(([k, text]) => <option key={k} value={k}>{text}</option>)}
              </select>
            ) : (
              <input id={`control-${p.id}`} type="number" step={p.type === 'int' ? 1 : 'any'} min={lo ?? undefined} max={hi ?? undefined}
                value={value} disabled={disabled} onChange={(e) => setDraft(e.target.value)} />
            )}
            <button className="primary" disabled={disabled || value === '' || draft === null || String(draft) === current}>Apply</button>
            {draft !== null && String(draft) !== current && <button type="button" onClick={() => setDraft(null)}>Reset</button>}
          </div>
          {(lo !== null || hi !== null) && <p className="sub">Allowed: {show(lo)} to {show(hi)}{p.unit ? ` ${p.unit}` : ''}</p>}
        </form>
      )}
      {action.error && <p className="command-status bad">{action.error}</p>}
      {!action.error && last && <CommandStatus c={last} />}
    </div>
  )
}

function StatusTab({ device, gateway, s }) {
  const pointStatus = (p) => {
    if (!p.last_time) return <Pill tone="offline">No data</Pill>
    if (p.kind === 'alarm' && Number(p.last_value) > 0) return <Pill tone="critical">Alarm</Pill>
    if (p.last_quality === 2) return <Pill tone="warning">Out of range</Pill>
    if (!p.approved) return <Pill tone="warning">Not approved</Pill>
    return <Pill tone="normal">Normal</Pill>
  }
  return (
    <>
      <Card>
        <dl className="stacked-facts">
          <dt>Gateway</dt><dd>{device.gateway_key}</dd>
          <dt>Connection</dt>
          <dd>{gateway?.status ? `${gateway.status} since ${new Date(gateway.status_at).toLocaleString()}` : 'never connected'}</dd>
          <dt>Latest value received</dt><dd>{s?.newest ? `${new Date(s.newest).toLocaleString()} (${ago(s.newest)})` : '—'}</dd>
        </dl>
      </Card>
      <div className="list-panel bare table-scroll">
        <table>
          <thead><tr><th>Point</th><th>Value</th><th>Unit</th><th>Updated</th><th>Status</th></tr></thead>
          <tbody>
            {device.properties.map((p) => (
              <tr key={p.id}>
                <td>{p.key}{!p.is_standard && <span className="sub"> · extension</span>}</td>
                <td>{p.last_time ? pointValue({ value: p.last_value }) : '—'}{p.held_count > 0 && <> <Badge tone="warn">{p.held_count} held</Badge></>}</td>
                <td>{show(p.unit)}</td>
                <td className="sub">{p.last_time ? ago(p.last_time) : '—'}</td>
                <td>{pointStatus(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Records n={device.properties.length} />
    </>
  )
}

function AnalyticsTab({ device }) {
  const [range, setRange] = useState('1h')
  const [tick, setTick] = useState(0)
  return (
    <>
      <div className="section-head">
        <div>
          <h2>Operational analytics</h2>
          <p className="page-sub">Inspect the historical behavior of this device's individual measurements. Select a chart for the detailed view.</p>
        </div>
        <button onClick={() => setTick((t) => t + 1)}>Refresh</button>
      </div>
      <Card><RangePicker value={range} onChange={setRange} /></Card>
      <Card><SmallMultiples deviceId={device.id} range={range} refresh={tick} /></Card>
    </>
  )
}

function DeviceForm({ device, gateways, onSave }) {
  const [form, setForm] = useState({
    name: device.name, site_tag: device.site_tag ?? '', device_key: device.device_key, gateway_id: device.gateway_id,
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
      <label>Name *<input value={form.name} onChange={set('name')} required /></label>
      <label>Site tag<input value={form.site_tag} onChange={set('site_tag')} /></label>
      <label>Device key *<input value={form.device_key} onChange={set('device_key')} required /></label>
      <label>Gateway *
        <select value={form.gateway_id} onChange={set('gateway_id')}>
          {gateways.map((g) => <option key={g.id} value={g.id}>{g.gateway_key}</option>)}
        </select>
      </label>
      <label>Profile<input value={`${device.profile_key}@${device.profile_major}.${device.profile_minor}`} disabled /></label>
      <div className="form-actions span-all"><button className="primary">Save details</button></div>
    </form>
  )
}

function Commissioning({ device, systems, onSave }) {
  const [systemId, setSystemId] = useState(device.system_id ?? '')
  const commissioned = device.status === 'commissioned'

  if (!systems.length) return <Empty>Create a system first to commission this device.</Empty>

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave({ status: 'commissioned', system_id: systemId }) }}>
      <p className="hint">
        {commissioned
          ? <>Placed in <strong>{device.system_name}</strong>.</>
          : 'Birth certificate received, not yet placed. Choose a system to commission it.'}
      </p>
      <label>System
        <select value={systemId} onChange={(e) => setSystemId(e.target.value)} required>
          <option value="">Choose…</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div className="form-actions">
        <button className="primary">{commissioned ? 'Move to system' : 'Commission'}</button>
        {commissioned && (
          <button type="button" onClick={() => onSave({ status: 'pending' })}>Set back to pending</button>
        )}
      </div>
    </form>
  )
}

function DeviceProperties({ device, reload, action }) {
  const [extKey, setExtKey] = useState('')
  const [charted, setCharted] = useState(null)
  const series = useLoad(() => api.deviceSeries(device.id, '1h'), [device])
  const sparkById = Object.fromEntries((series.data ?? []).map((s) => [s.id, s.points]))
  const [synced, setSynced] = useState(null)

  const sync = () => action.run(async () => {
    const { added } = await api.syncDevice(device.id)
    setSynced(added)
    reload()
  })

  const addExtension = async (e) => {
    e.preventDefault()
    if (await action.run(() => api.addExtension(device.id, { key: extKey }))) {
      setExtKey('')
      reload()
    }
  }

  return (
    <Card
      title={`Properties (${device.properties.length})`}
      actions={
        <>
          {synced !== null && <span className="hint">{synced ? `Added ${synced}` : 'Already up to date'}</span>}
          <button onClick={sync}>Sync from profile</button>
        </>
      }
    >
      {device.properties.length === 0 && <Empty>No properties. Add some to the profile, then sync.</Empty>}
      {device.properties.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Key</th><th>Source</th><th>Latest</th><th>Declared</th><th>Min override</th><th>Max override</th>
                <th>Read-only</th><th>Approved</th><th /></tr>
            </thead>
            <tbody>
              {device.properties.map((p) => (
                <PropertyRow key={JSON.stringify(p)} p={p} reload={reload} action={action}
                  spark={sparkById[p.id]} charted={charted === p.id}
                  onChart={() => setCharted((c) => (c === p.id ? null : p.id))} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {charted && <PropertyHistory key={charted} id={charted} onClose={() => setCharted(null)} />}
      <form className="inline-form top-gap" onSubmit={addExtension}>
        <input value={extKey} onChange={(e) => setExtKey(e.target.value)} placeholder="Extension key (not in the profile)" required />
        <button>Add extension</button>
      </form>
    </Card>
  )
}

function PropertyRow({ p, reload, action, spark, charted, onChart }) {
  const initial = { min: numOrBlank(p.min_override), max: numOrBlank(p.max_override), readOnly: p.writable_override === false }
  const [form, setForm] = useState(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const patch = (body) => action.run(async () => { await api.updateDeviceProperty(p.id, body); reload() })

  const save = () => patch({
    min_override: form.min,
    max_override: form.max,
    writable_override: form.readOnly ? false : null,
  })

  const remove = async () => {
    if (!window.confirm(`Delete extension ${p.key}?`)) return
    if (await action.run(() => api.deleteDeviceProperty(p.id))) reload()
  }

  const declared = p.is_standard
    ? [p.kind, p.type, p.unit, p.declared_min !== null || p.declared_max !== null
        ? `${show(p.declared_min)} … ${show(p.declared_max)}` : null].filter(Boolean).join(' · ')
    : '—'

  return (
    <tr className={[p.approved ? '' : 'attention', charted ? 'selected' : ''].join(' ')}>
      <td><strong>{p.key}</strong></td>
      <td>{p.is_standard ? <Badge>standard</Badge> : <Badge tone="info">extension</Badge>}</td>
      <td className="nowrap">
        {p.last_time
          ? <span className="spark-cell" title={new Date(p.last_time).toLocaleString()}>
              <Sparkline points={spark} />
              {show(p.last_value)}{p.unit && <span className="sub"> {p.unit}</span>}{' '}
              {p.last_quality === 2 && <Badge tone="danger">out of range</Badge>}
              <span className="sub"> {ago(p.last_time)}</span>
            </span>
          : <span className="sub">no data</span>}
        {p.held_count > 0 && <> <Badge tone="warn" >{p.held_count} held</Badge></>}
      </td>
      <td className="sub">{declared}</td>
      <td><input className="num" type="number" step="any" value={form.min} disabled={!p.is_standard}
        onChange={(e) => setForm({ ...form, min: e.target.value })} /></td>
      <td><input className="num" type="number" step="any" value={form.max} disabled={!p.is_standard}
        onChange={(e) => setForm({ ...form, max: e.target.value })} /></td>
      <td>
        {p.is_standard && p.declared_writable
          ? <input type="checkbox" checked={form.readOnly} onChange={(e) => setForm({ ...form, readOnly: e.target.checked })} />
          : <span className="sub">—</span>}
      </td>
      <td><input type="checkbox" checked={p.approved} onChange={(e) => patch({ approved: e.target.checked })} /></td>
      <td className="row-actions">
        {p.last_time && <button className={`small ${charted ? 'primary' : ''}`} onClick={onChart}>Chart</button>}
        {dirty && <button className="small primary" onClick={save}>Save</button>}
        {!p.is_standard && <button className="small danger" onClick={remove}>Delete</button>}
      </td>
    </tr>
  )
}
