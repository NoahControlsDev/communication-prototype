import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction } from '../lib.js'
import { Errors } from '../ui.jsx'
import { Faceplate } from './faceplates.jsx'
import { deviceState } from './model.js'

const GRID = 20
const NODE_W = 320
const NODE_H = 220
const HEAD_H = 34
const PORT_Y = 120
const SLOT_X = NODE_W + 100
const SLOT_Y = NODE_H + 60
const ORIGIN = { x: 60, y: 40 }
const COLS = 3
const MIN_W = ORIGIN.x * 2 + COLS * NODE_W + (COLS - 1) * 100
const MIN_H = 600
const POLL_MS = 5000
const TAG_W = 170
const TAG_H = 24
const TAG_GAP = 4
const SYSTEM_TAG_W = 250

const snap = (v) => Math.max(0, Math.round(v / GRID) * GRID)
const overlaps = (a, b) => Math.abs(a.x - b.x) < NODE_W + GRID && Math.abs(a.y - b.y) < NODE_H + GRID

function arrange(devices, moved) {
  const spots = new Map()
  const auto = []
  for (const d of devices) {
    const at = moved[d.id] ?? (d.map_x === null ? null : { x: d.map_x, y: d.map_y })
    if (at) spots.set(d.id, at)
    else auto.push(d)
  }
  let slot = 0
  for (const d of auto) {
    let at
    do {
      at = { x: ORIGIN.x + (slot % COLS) * SLOT_X, y: ORIGIN.y + Math.floor(slot / COLS) * SLOT_Y }
      slot += 1
    } while ([...spots.values()].some((other) => overlaps(at, other)))
    spots.set(d.id, at)
  }
  return spots
}

const portPoint = (at, port) => ({ x: port === 'supply' ? at.x + NODE_W : at.x, y: at.y + PORT_Y })

function pipePath(from, to, underY) {
  if (to.x - from.x >= 2 * GRID) {
    const mid = snap((from.x + to.x) / 2)
    return `M${from.x} ${from.y}H${mid}V${to.y}H${to.x}`
  }
  return `M${from.x} ${from.y}H${from.x + GRID * 2}V${underY}H${to.x - GRID * 2}V${to.y}H${to.x}`
}

function tagGeometry(at, port, n) {
  const top = at.y + NODE_H + 8 + n * (TAG_H + TAG_GAP)
  const mid = top + TAG_H / 2
  const p = portPoint(at, port)
  return port === 'supply'
    ? { left: at.x + NODE_W + 14 - TAG_W, top, path: `M${p.x} ${p.y}H${p.x + GRID}V${mid}H${at.x + NODE_W + 14}` }
    : { left: at.x - 14, top, path: `M${at.x - 14} ${mid}H${p.x - GRID}V${p.y}H${p.x}` }
}

export default function SystemMap({ systemId }) {
  const canvasRef = useRef(null)
  const devices = useLoad(api.devices)
  const profiles = useLoad(api.profiles)
  const latest = useLoad(api.dataLatest)
  const connections = useLoad(api.connections)
  const systems = useLoad(() => api.list('systems'))
  const action = useAction()
  const [moved, setMoved] = useState({})
  const [draft, setDraft] = useState(null)
  const [selectedPipe, setSelectedPipe] = useState(null)
  const [linking, setLinking] = useState(false)
  const [link, setLink] = useState({ here: '', direction: 'supplies', there: '' })

  const { reload: reloadDevices } = devices
  const { reload: reloadLatest } = latest
  useEffect(() => {
    const t = setInterval(() => { reloadLatest(); reloadDevices() }, POLL_MS)
    return () => clearInterval(t)
  }, [reloadLatest, reloadDevices])

  const inSystem = useMemo(() => (devices.data ?? []).filter((d) => d.system_id === systemId), [devices.data, systemId])
  const states = useMemo(() => {
    if (!profiles.data || !latest.data) return new Map()
    const profileById = new Map(profiles.data.map((p) => [p.id, p]))
    return new Map((devices.data ?? []).map((d) => [d.id,
      deviceState(d, profileById.get(d.profile_id), latest.data.filter((r) => r.device_id === d.id))]))
  }, [devices.data, profiles.data, latest.data])

  const spots = arrange(inSystem, moved)
  const nodesWidth = Math.max(MIN_W, ...[...spots.values()].map((p) => p.x + NODE_W + ORIGIN.x))
  const byId = new Map((devices.data ?? []).map((d) => [d.id, d]))
  const systemById = new Map((systems.data ?? []).map((s) => [s.id, s]))
  const where = (d) => d.system_name ?? 'not placed in a system'
  const end = (c, side) => {
    const device = byId.get(c[`${side}_device_id`])
    if (device) return { device, local: spots.has(device.id), label: device.name, sub: device.system_name ?? 'not placed', href: device.system_id ? `#/systems/${device.system_id}/map` : `#/devices/${device.id}` }
    const system = systemById.get(c[`${side}_system_id`])
    if (system) return { system, here: system.id === systemId, label: system.name, sub: 'whole system', href: `#/systems/${system.id}/map` }
    return null
  }
  const known = (connections.data ?? [])
    .map((c) => ({ ...c, from: end(c, 'from'), to: end(c, 'to') }))
    .filter((c) => c.from && c.to)
  const pipes = known.filter((c) => c.from.local && c.to.local)
  const perPort = new Map()
  const ties = known.filter((c) => Boolean(c.from.local) !== Boolean(c.to.local) && !c.from.here && !c.to.here).map((c) => {
    const port = c.from.local ? 'supply' : 'return'
    const localId = (port === 'supply' ? c.from : c.to).device.id
    const remote = port === 'supply' ? c.to : c.from
    const n = perPort.get(`${localId}:${port}`) ?? 0
    perPort.set(`${localId}:${port}`, n + 1)
    return { ...c, port, localId, remote, ...tagGeometry(spots.get(localId), port, n) }
  })
  const systemTies = known.filter((c) => c.from.here || c.to.here).map((c, i) => ({
    ...c, incoming: Boolean(c.to.here), remote: c.to.here ? c.from : c.to, left: GRID + i * (SYSTEM_TAG_W + GRID / 2), top: 8,
  }))
  const elsewhere = (devices.data ?? []).filter((d) => d.system_id !== systemId)
  const otherSystems = (systems.data ?? []).filter((s) => s.id !== systemId)
  const name = (id) => byId.get(id)?.name ?? `#${id}`
  const height = Math.max(MIN_H, ...[...spots.values()].map((p) => p.y + NODE_H + 80), ...ties.map((t) => t.top + TAG_H + GRID))
  const width = Math.max(nodesWidth, GRID * 2 + systemTies.length * (SYSTEM_TAG_W + GRID / 2))
  const arranged = inSystem.some((d) => (moved[d.id] ?? (d.map_x === null ? null : d)) !== null)

  const toCanvas = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const beginMove = (event, d) => {
    if (event.button !== 0 || event.target.closest('a')) return
    event.preventDefault()
    const start = spots.get(d.id)
    const origin = { x: event.clientX, y: event.clientY }
    let at = start
    const move = (e) => {
      at = { x: snap(start.x + e.clientX - origin.x), y: snap(start.y + e.clientY - origin.y) }
      setMoved((m) => ({ ...m, [d.id]: at }))
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      if (at !== start) action.run(() => api.updateDevice(d.id, { map_x: at.x, map_y: at.y }))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const autoArrange = () => action.run(async () => {
    await Promise.all(inSystem.filter((d) => d.map_x !== null || moved[d.id])
      .map((d) => api.updateDevice(d.id, { map_x: null, map_y: null })))
    setMoved({})
    reloadDevices()
  })

  const connectEnds = (body) => action.run(async () => {
    const same = (c) => ['from_device_id', 'from_system_id', 'to_device_id', 'to_system_id'].every((k) => (c[k] ?? null) === (body[k] ?? null))
    const existing = known.find(same)
    if (existing) return setSelectedPipe(existing.id)
    const created = await api.createConnection(body)
    setSelectedPipe(created.id)
    connections.reload()
  })
  const connect = (supplyId, returnId) => connectEnds({ from_device_id: supplyId, to_device_id: returnId })

  const removePipe = (id) => action.run(async () => {
    await api.deleteConnection(id)
    setSelectedPipe(null)
    connections.reload()
  })

  const beginPipe = (event, deviceId, port) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const start = portPoint(spots.get(deviceId), port)
    setSelectedPipe(null)
    setDraft({ port, start, pointer: start })

    const move = (e) => setDraft((d) => d && { ...d, pointer: toCanvas(e) })
    const end = (e) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      setDraft(null)
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-port]')
      const targetId = Number(target?.dataset.deviceId)
      if (!target || targetId === deviceId || target.dataset.port === port) return
      if (port === 'supply') connect(deviceId, targetId)
      else connect(targetId, deviceId)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const addTie = (e) => {
    e.preventDefault()
    const parse = (value, side) => {
      const [kind, id] = value.split(':')
      return { [`${side}_${kind === 's' ? 'system' : 'device'}_id`]: Number(id) }
    }
    if (link.here.startsWith('s:') && link.there.startsWith('s:')) {
      action.setError('One end of a tie has to be a device. Pick a device on at least one side.')
      return
    }
    const [from, to] = link.direction === 'supplies' ? [link.here, link.there] : [link.there, link.here]
    connectEnds({ ...parse(from, 'from'), ...parse(to, 'to') })
    setLink({ ...link, there: '' })
  }

  const tagRows = Math.max(0, ...perPort.values())
  const underOf = (a, b) => snap(Math.max(a.y, b.y) + NODE_H + GRID * 1.5 + tagRows * (TAG_H + TAG_GAP))

  return (
    <div className="sm-wrap">
      <div className="sm-bar">
        <span className="sub">
          Devices appear here automatically. Drag a title bar to move a device; drag from a <strong>supply</strong> port
          (right) to a <strong>return</strong> port (left) to draw a pipe.
        </span>
        <span className="spacer" />
        {selectedPipe && <button className="small danger" onClick={() => removePipe(selectedPipe)}>Delete pipe</button>}
        {arranged && <button className="small" onClick={autoArrange}>Auto-arrange</button>}
        {(elsewhere.length > 0 || otherSystems.length > 0) && !linking && <button className="small" onClick={() => setLinking(true)}>Tie to another system…</button>}
      </div>

      {linking && (
        <form className="subpanel sm-link" onSubmit={addTie}>
          <label>In this system
            <select value={link.here} onChange={(e) => setLink({ ...link, here: e.target.value })} required>
              <option value="">Choose…</option>
              <option value={`s:${systemId}`}>This whole system</option>
              {inSystem.map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}
            </select>
          </label>
          <label>Direction
            <select value={link.direction} onChange={(e) => setLink({ ...link, direction: e.target.value })}>
              <option value="supplies">supplies →</option>
              <option value="supplied">← is supplied by</option>
            </select>
          </label>
          <label>Elsewhere
            <select value={link.there} onChange={(e) => setLink({ ...link, there: e.target.value })} required>
              <option value="">Choose…</option>
              {otherSystems.length > 0 && (
                <optgroup label="A whole system">
                  {otherSystems.map((s) => <option key={s.id} value={`s:${s.id}`}>{s.name}</option>)}
                </optgroup>
              )}
              {[...new Set(elsewhere.map(where))].sort().map((group) => (
                <optgroup key={group} label={`Device in: ${group}`}>
                  {elsewhere.filter((d) => where(d) === group).map((d) => <option key={d.id} value={`d:${d.id}`}>{d.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="primary">Add tie</button>
          <button type="button" onClick={() => setLinking(false)}>Done</button>
        </form>
      )}
      <Errors errors={[devices.error, profiles.error, latest.error, connections.error, systems.error, action.error]} />

      <div className="sm-scroll">
        <div ref={canvasRef} className={`sm-canvas ${draft ? 'is-drawing' : ''}`} style={{ width, minWidth: '100%', height }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedPipe(null) }}>
          <svg className="sm-pipes" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Pipes between devices">
            {pipes.map((c) => {
              const a = spots.get(c.from_device_id), b = spots.get(c.to_device_id)
              const d = pipePath(portPoint(a, 'supply'), portPoint(b, 'return'), underOf(a, b))
              const flowing = states.get(c.from_device_id)?.running
              return (
                <g key={c.id} className={`sm-pipe ${selectedPipe === c.id ? 'is-selected' : ''}`}
                  onPointerDown={(e) => { e.stopPropagation(); setSelectedPipe(c.id) }}>
                  <title>{c.from.label} supply → {c.to.label} return</title>
                  <path className="pipe-hit" d={d} />
                  <path className="pipe-casing" d={d} />
                  <path className={`pipe-core ${flowing ? 'is-flowing' : ''}`} d={d} />
                </g>
              )
            })}
            {ties.map((t) => (
              <g key={t.id} className={`sm-pipe ${selectedPipe === t.id ? 'is-selected' : ''}`}
                onPointerDown={(e) => { e.stopPropagation(); setSelectedPipe(t.id) }}>
                <path className="pipe-hit" d={t.path} />
                <path className="pipe-casing" d={t.path} />
                <path className={`pipe-core ${states.get(t.from.device?.id)?.running ? 'is-flowing' : ''}`} d={t.path} />
              </g>
            ))}
            {draft && (
              <path className="pipe-draft" d={draft.port === 'supply'
                ? `M${draft.start.x} ${draft.start.y}L${draft.pointer.x} ${draft.pointer.y}`
                : `M${draft.pointer.x} ${draft.pointer.y}L${draft.start.x} ${draft.start.y}`} />
            )}
          </svg>

          {inSystem.map((d) => {
            const at = spots.get(d.id)
            const s = states.get(d.id)
            return (
              <article key={d.id} className="sm-node" style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
                data-alarm={s?.alarm ?? ''} data-dim={s?.dim ? '1' : '0'}>
                <header className="sm-head" style={{ height: HEAD_H }} onPointerDown={(e) => beginMove(e, d)}>
                  <span className="sm-grip" aria-hidden="true">⠿</span>
                  <a href={`#/devices/${d.id}`} title="Open device">{d.name}</a>
                  {s && <span className={`plant-state state-${s.label.toLowerCase().replace(/ /g, '-')}`}>{s.label}</span>}
                </header>
                {s && <Faceplate s={s} />}
                {['return', 'supply'].map((port) => (
                  <button key={port} className={`sm-port port-${port}`} style={{ top: PORT_Y }}
                    data-device-id={d.id} data-port={port}
                    title={`${d.name} ${port}: drag to another device's ${port === 'supply' ? 'return' : 'supply'}`}
                    aria-label={`${d.name} ${port} port`}
                    onPointerDown={(e) => beginPipe(e, d.id, port)} />
                ))}
              </article>
            )
          })}

          {ties.map((t) => (
            <a key={t.id} className={`sm-tag tag-${t.port} ${selectedPipe === t.id ? 'is-selected' : ''}`}
              style={{ left: t.left, top: t.top, width: TAG_W, height: TAG_H }}
              href={t.remote.href}
              title={`${name(t.localId)} ${t.port === 'supply' ? 'supplies' : 'is supplied by'} ${t.remote.label} (${t.remote.sub}). Click to go there.`}
              onPointerEnter={() => setSelectedPipe(t.id)}>
              <span className="sm-tag-arrow" aria-hidden="true">{t.port === 'supply' ? '→' : '←'}</span>
              <strong>{t.remote.label}</strong>
              <span className="sub">{t.remote.sub}</span>
            </a>
          ))}

          {systemTies.map((t) => (
            <a key={t.id} className={`sm-tag tag-system ${selectedPipe === t.id ? 'is-selected' : ''}`}
              style={{ left: t.left, top: t.top, width: SYSTEM_TAG_W, height: TAG_H }} href={t.remote.href}
              title={`${t.remote.label} (${t.remote.sub}) ${t.incoming ? 'supplies' : 'is supplied by'} this whole system. Click to go there.`}
              onPointerEnter={() => setSelectedPipe(t.id)}>
              <span className="sm-tag-arrow" aria-hidden="true">{t.incoming ? 'from' : 'to'}</span>
              <strong>{t.remote.label}</strong>
              <span className="sub">{t.remote.sub}</span>
            </a>
          ))}

          {devices.data && !inSystem.length && (
            <p className="sm-empty">
              No devices in this system yet. Open a device and commission it into this system; it then appears here on its own.
            </p>
          )}
        </div>
      </div>

      <div className="sm-list">
        <h3 className="label">Pipes ({pipes.length + ties.length + systemTies.length})</h3>
        {connections.data && !pipes.length && !ties.length && !systemTies.length && <p className="sub">None drawn yet.</p>}
        {[...systemTies, ...ties].map((t) => (
          <div key={t.id} className={`sm-list-row ${selectedPipe === t.id ? 'is-selected' : ''}`}
            onPointerEnter={() => setSelectedPipe(t.id)}>
            <span>
              <strong>{t.from.label}</strong> <span className="sub">{t.from.system ? 'whole system' : 'supply'}</span> → <strong>{t.to.label}</strong> <span className="sub">{t.to.system ? 'whole system' : 'return'}</span>{' '}
              {t.remote.device && <span className="badge info">{t.remote.label} is in {where(t.remote.device)}</span>}
            </span>
            <button className="small danger" onClick={() => removePipe(t.id)}>Remove</button>
          </div>
        ))}
        {pipes.map((c) => (
          <div key={c.id} className={`sm-list-row ${selectedPipe === c.id ? 'is-selected' : ''}`}
            onPointerEnter={() => setSelectedPipe(c.id)}>
            <span><strong>{c.from.label}</strong> <span className="sub">supply</span> → <strong>{c.to.label}</strong> <span className="sub">return</span></span>
            <button className="small danger" onClick={() => removePipe(c.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
