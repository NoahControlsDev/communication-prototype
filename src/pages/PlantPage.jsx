import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useLoad, ago, profileName } from '../lib.js'
import { PageHeader, Errors, Empty, Badge } from '../ui.jsx'
import { Glyph } from '../plant/glyphs.jsx'
import { deviceState, groupDevices } from '../plant/model.js'
import { formatValue } from '../charts/format.js'

const POLL_MS = 5000

export default function PlantPage() {
  const devices = useLoad(api.devices)
  const profiles = useLoad(api.profiles)
  const latest = useLoad(api.dataLatest)
  const [live, setLive] = useState(true)
  const [selected, setSelected] = useState(null)

  const { reload: reloadDevices } = devices
  const { reload: reloadLatest } = latest
  useEffect(() => {
    if (!live) return undefined
    const t = setInterval(() => { reloadLatest(); reloadDevices() }, POLL_MS)
    return () => clearInterval(t)
  }, [live, reloadLatest, reloadDevices])

  const states = useMemo(() => {
    if (!devices.data || !profiles.data || !latest.data) return []
    const profileById = new Map(profiles.data.map((p) => [p.id, p]))
    const pointsByDevice = new Map()
    for (const r of latest.data) {
      if (!pointsByDevice.has(r.device_id)) pointsByDevice.set(r.device_id, [])
      pointsByDevice.get(r.device_id).push(r)
    }
    return devices.data.map((d) => deviceState(d, profileById.get(d.profile_id), pointsByDevice.get(d.id) ?? []))
  }, [devices.data, profiles.data, latest.data])

  const groups = groupDevices(states)
  const current = states.find((s) => s.device.id === selected) ?? null
  const counts = {
    running: states.filter((s) => s.running).length,
    alarm: states.filter((s) => s.alarm === 'critical').length,
    dim: states.filter((s) => s.dim).length,
  }

  return (
    <>
      <PageHeader title="Plant" subtitle="Live view of every device, drawn from its profile.">
        <span className="sub plant-summary">
          {counts.running} running · {counts.alarm} in alarm · {counts.dim} offline / no data
        </span>
        <button className={live ? 'primary' : ''} onClick={() => setLive((l) => !l)}>
          {live ? 'Live' : 'Paused'}
        </button>
      </PageHeader>
      <Errors errors={[devices.error, profiles.error, latest.error]} />

      {devices.data && !states.length && <Empty>No devices yet.</Empty>}

      <div className="plant-cols">
        <div className="plant-groups">
          {groups.map((g) => (
            <section key={g.id} className="plant-panel">
              <header className="plant-panel-head">
                <strong>{g.title}</strong>
                <span className="sub">{g.subtitle}</span>
              </header>
              <div className="plant-grid">
                {g.states.map((s) => (
                  <DeviceTile key={s.device.id} s={s} selected={selected === s.device.id}
                    onSelect={() => setSelected(s.device.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="plant-insp card">
          {current ? <Inspector s={current} /> : <p className="empty pad">Select a device to see its live values.</p>}
        </aside>
      </div>
    </>
  )
}

function DeviceTile({ s, selected, onSelect }) {
  return (
    <button
      className="plant-dev"
      data-run={s.running ? '1' : '0'}
      data-dim={s.dim ? '1' : '0'}
      data-alarm={s.alarm ?? ''}
      data-sel={selected ? '1' : '0'}
      onClick={onSelect}
      aria-label={`${s.device.name}: ${s.label}`}
    >
      <Glyph name={s.glyph} />
      <span className="plant-tag">{s.device.name}</span>
      <span className={`plant-state state-${s.label.toLowerCase().replace(/ /g, '-')}`}>{s.label}</span>
      {s.readouts.map(({ key, point }) => (
        <span key={key} className="plant-ro">
          <span className="plant-ro-k">{key}</span>
          <span>{point ? formatValue(Number(point.value)) : '—'}{point?.unit ? ` ${point.unit}` : ''}</span>
        </span>
      ))}
    </button>
  )
}

function Inspector({ s }) {
  const d = s.device
  return (
    <div>
      <div className="insp-head">
        <h3>{d.name}</h3>
        <div className="sub">{d.device_key} · {d.gateway_key}</div>
        <div className="chips top-gap">
          <Badge tone="info">{d.profile_key}@{d.profile_major}.{d.profile_minor}</Badge>
          <Badge>glyph: {s.glyph}</Badge>
          <Badge tone={s.running ? 'ok' : s.dim ? 'neutral' : 'warn'}>{s.label.toLowerCase()}</Badge>
        </div>
        {s.alarms.length > 0 && <p className="tt-status">alarm: {s.alarms.join(', ')}</p>}
        {!s.profile?.display && (
          <p className="hint">
            No display set for {s.profile ? profileName(s.profile) : 'this type'}: set its glyph and running rule on
            the <a href={`#/profiles/${d.profile_id}`}>profile</a>.
          </p>
        )}
      </div>
      {s.points.length ? (
        <table className="compact numeric insp-table">
          <tbody>
            {s.points.map((p) => (
              <tr key={p.key}>
                <td>{p.key}{s.profile?.display?.run === p.key && <span className="sub"> · run</span>}</td>
                <td className="num-cell">
                  {formatValue(Number(p.value))}{p.unit && <span className="sub"> {p.unit}</span>}
                  {p.quality === 2 && <span className="status-icon" title="out of range"> ⚠</span>}
                </td>
                <td className="sub">{ago(p.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty pad">No readings yet.</p>}
      <p className="pad">
        <a className="small-link" href={`#/devices/${d.id}`}>Device →</a>{' '}
        <a className="small-link" href={`#/fields/${encodeURIComponent(d.device_key)}`}>Fields →</a>
      </p>
    </div>
  )
}
