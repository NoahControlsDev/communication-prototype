import { useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction, go, show } from '../lib.js'
import { PageHeader, Card, Errors, Empty } from '../ui.jsx'
import { useLive } from '../live.js'
import {
  Pill, DeviceStatusPill, RunPills, Tabs, Records, Tile, ValueTiles, groupStatus,
  AlertsPanel, EventsPanel, DocumentsPanel,
} from '../workspace.jsx'
import SystemMap from '../plant/SystemMap.jsx'
import RangePicker from '../charts/RangePicker.jsx'
import SmallMultiples from '../charts/SmallMultiples.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' }, { id: 'map', label: 'System map' }, { id: 'devices', label: 'Devices' },
  { id: 'configuration', label: 'Configuration' }, { id: 'analytics', label: 'Analytics' }, { id: 'alerts', label: 'Alerts' },
  { id: 'events', label: 'Events' }, { id: 'documents', label: 'Documents' },
]
const typeOf = (d) => `${d.profile_key}@${d.profile_major}.${d.profile_minor}`

// One system's workspace: summary, its map, its devices, and their alerts and events.
export default function SystemPage({ id, tab }) {
  const current = TABS.some((t) => t.id === tab) ? tab : 'overview'
  const setTab = (t) => go(`#/systems/${id}${t === 'overview' ? '' : `/${t}`}`)
  const systems = useLoad(() => api.list('systems'))
  const live = useLive()
  const action = useAction()
  const system = systems.data?.find((s) => s.id === id)

  if (systems.data && !system) return <Errors errors={['System not found']} />
  if (!system) return <Errors errors={[systems.error]} />

  const devices = live.devices.filter((d) => d.system_id === id)
  const states = devices.map((d) => live.states.get(d.id)).filter(Boolean)
  const status = groupStatus(states)
  const count = (fn) => states.filter(fn).length
  const gateways = [...new Set(devices.map((d) => d.gateway_key))]

  return (
    <>
      <PageHeader title={system.name} subtitle="System operational workspace"
        crumbs={[{ label: 'Systems', href: '#/systems' }, ...(current === 'overview' ? [] : [{ label: system.name, href: `#/systems/${id}` }])]}
        current={current === 'overview' ? system.name : TABS.find((t) => t.id === current).label}>
        {current !== 'configuration' && <button className="primary" onClick={() => setTab('configuration')}>Edit System</button>}
      </PageHeader>
      <Errors errors={[...live.errors, action.error]} />
      <Tabs tabs={TABS} value={current} onChange={setTab} />

      {current === 'overview' && (
        <>
          <div className="two-col">
            <Card>
              <div className="panel-pills left">{live.loaded && <Pill tone={status.tone}>{status.label}</Pill>}</div>
              <dl className="stacked-facts inset">
                <dt>System name</dt><dd>{system.name}</dd>
                <dt>Connected devices</dt><dd>{devices.length}</dd>
                <dt>Gateways</dt><dd>{gateways.length ? gateways.join(', ') : '—'}</dd>
              </dl>
            </Card>
            <Card>
              <div className="tiles">
                <Tile label="Running">{count((s) => s.running)}</Tile>
                <Tile label="In alarm">{count((s) => !s.dim && s.alarm === 'critical')}</Tile>
                <Tile label="Out of range">{count((s) => !s.dim && s.alarm === 'warning')}</Tile>
                <Tile label="Offline or no data">{count((s) => s.dim)}</Tile>
              </div>
              <p className="sub top-gap">
                System-wide controls are not available yet. <button className="link" onClick={() => setTab('map')}>Open the system map</button> for the live drawing.
              </p>
            </Card>
          </div>

          <h2 className="section-title">Connected Devices</h2>
          {live.loaded && !devices.length && <Empty>No devices in this system yet. Open a device and commission it into this system.</Empty>}
          <div className="device-cards">
            {devices.map((d) => {
              const s = live.states.get(d.id)
              return (
                <Card key={d.id}>
                  <div className="device-card-head">
                    <a className="row-link" href={`#/devices/${d.id}`}>{d.name}</a>
                    <span>{typeOf(d)}</span>
                  </div>
                  <div className="panel-pills left"><RunPills s={s} /></div>
                  <ValueTiles s={s} max={4} />
                </Card>
              )
            })}
          </div>
        </>
      )}

      {current === 'map' && <SystemMap systemId={id} />}

      {current === 'devices' && (
        <>
          <div className="section-head">
            <div><h2>System devices</h2><p className="page-sub">Devices placed in {system.name}.</p></div>
            <button className="primary" onClick={() => go('#/devices')} title="Devices are placed in a system from their own page">Add Device</button>
          </div>
          <div className="list-panel table-scroll">
            <table>
              <thead><tr><th>Device</th><th>Type</th><th>Gateway</th><th>Site tag</th><th>Status</th></tr></thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td><a className="row-link" href={`#/devices/${d.id}`}>{d.name}</a></td>
                    <td>{typeOf(d)}</td>
                    <td>{d.gateway_key}</td>
                    <td>{show(d.site_tag)}</td>
                    <td>{live.loaded && <DeviceStatusPill s={live.states.get(d.id)} />}</td>
                  </tr>
                ))}
                {live.loaded && !devices.length && <tr><td colSpan={5} className="sub">No devices in this system yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Records n={devices.length} />
        </>
      )}

      {current === 'configuration' && (
        <SystemConfiguration key={system.name} system={system} deviceCount={devices.length} action={action} onSaved={systems.reload} />
      )}

      {current === 'analytics' && <SystemAnalytics devices={devices} />}
      {current === 'alerts' && <AlertsPanel states={states} />}
      {current === 'events' && <EventsPanel devices={devices} />}
      {current === 'documents' && <DocumentsPanel name={system.name} />}
    </>
  )
}

function SystemConfiguration({ system, deviceCount, action, onSaved }) {
  const [name, setName] = useState(system.name)

  const save = async (e) => {
    e.preventDefault()
    if (await action.run(() => api.update('systems', system.id, { name }))) onSaved()
  }
  const remove = async () => {
    if (!window.confirm(`Delete ${system.name}?`)) return
    if (await action.run(() => api.remove('systems', system.id))) go('#/systems')
  }

  return (
    <>
      <Card title="Details">
        <form className="inline-form" onSubmit={save}>
          <label className="grow">System name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <button className="primary" disabled={name === system.name}>Save</button>
        </form>
      </Card>
      <Card>
        <h2 className="danger-title">Delete system</h2>
        <p className="page-sub">
          {deviceCount
            ? `This system still holds ${deviceCount} device${deviceCount === 1 ? '' : 's'}. Move them to another system or set them back to unplaced first.`
            : 'Permanently remove this system. It holds no devices.'}
        </p>
        <button className="danger-solid top-gap" onClick={remove} disabled={deviceCount > 0}>Delete system</button>
      </Card>
    </>
  )
}

function SystemAnalytics({ devices }) {
  const [range, setRange] = useState('1h')
  return (
    <>
      <div className="section-head">
        <div><h2>Operational analytics</h2><p className="page-sub">History of every measurement in this system, one block per device.</p></div>
      </div>
      <Card><RangePicker value={range} onChange={setRange} /></Card>
      {!devices.length && <Empty>No devices in this system yet.</Empty>}
      {devices.map((d) => (
        <Card key={d.id} title={d.name} actions={<a className="small-link" href={`#/devices/${d.id}/analytics`}>Open device →</a>}>
          <SmallMultiples deviceId={d.id} range={range} refresh={0} />
        </Card>
      ))}
    </>
  )
}
