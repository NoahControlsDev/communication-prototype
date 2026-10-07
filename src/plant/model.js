// Turns devices + profiles + latest values into what the mimic draws.
// Nothing here is device-specific: everything comes from the profile's display config.

// Glyphs the Plant page can draw (see glyphs.jsx).
export const GLYPH_NAMES = ['pump', 'vessel', 'fanbox', 'generic']

export const STALE_AFTER_MS = 5 * 60 * 1000 // no reading for 5 min → stale

const OPS = {
  gt: (v, x) => v > x,
  eq: (v, x) => v === x,
  ne: (v, x) => v !== x,
}

export function isRunning(display, values) {
  if (!display?.run) return null // unknown: no running rule configured
  const v = values[display.run]?.value
  if (v === null || v === undefined) return null
  const { op = 'gt', value = 0 } = display.when ?? {}
  return (OPS[op] ?? OPS.gt)(Number(v), Number(value))
}

// One device's mimic state.
export function deviceState(device, profile, points) {
  const values = Object.fromEntries(points.map((p) => [p.key, p]))
  const display = profile?.display ?? null
  const newest = points.reduce((a, p) => (!a || p.time > a ? p.time : a), null)
  const offline = points[0]?.gateway_status === 'offline'
  const stale = newest && Date.now() - new Date(newest).getTime() > STALE_AFTER_MS
  const alarms = points.filter((p) => p.kind === 'alarm' && Number(p.value) > 0).map((p) => p.key)
  const outOfRange = points.filter((p) => p.quality === 2).map((p) => p.key)
  const running = isRunning(display, values)
  const readoutKeys = display?.readouts?.length ? display.readouts : points.slice(0, 2).map((p) => p.key)

  let label
  if (!points.length) label = 'NO DATA'
  else if (offline) label = 'OFFLINE'
  else if (stale) label = 'STALE'
  else if (alarms.length) label = 'ALARM'
  else if (running === true) label = 'RUNNING'
  else if (running === false) label = 'STOPPED'
  else label = 'NO RUN RULE'

  return {
    device, profile, points, values, newest,
    glyph: display?.glyph ?? 'generic',
    running: Boolean(running) && !offline && !stale,
    dim: !points.length || offline || stale,
    alarm: alarms.length ? 'critical' : outOfRange.length ? 'warning' : null,
    alarms, outOfRange, label,
    readouts: readoutKeys.map((k) => ({ key: k, point: values[k] })),
  }
}

// Systems first (in name order), then devices not placed yet, grouped by gateway.
export function groupDevices(states) {
  const groups = new Map()
  for (const s of states) {
    const d = s.device
    const id = d.system_id ? `sys:${d.system_id}` : `gw:${d.gateway_key}`
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        title: d.system_id ? d.system_name : d.gateway_key,
        subtitle: d.system_id ? 'system' : 'not placed in a system',
        placed: Boolean(d.system_id),
        states: [],
      })
    }
    groups.get(id).states.push(s)
  }
  return [...groups.values()].sort((a, b) => b.placed - a.placed || a.title.localeCompare(b.title))
}
