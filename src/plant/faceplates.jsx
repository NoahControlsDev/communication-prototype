import { formatValue } from '../charts/format.js'

// Detailed device drawings for the system map. Each is driven by the device's live state
// (see deviceState in model.js): the equipment on the left animates from the data, and up to
// three values are drawn beside it as readouts with their range.
// Like the small glyphs, nothing here knows a specific device: it all comes from the profile.

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const num = (p) => (p && p.value !== null && p.value !== undefined ? Number(p.value) : null)

// Where a value sits in its declared range, 0–1. Percent values need no declared range.
function position(p) {
  const v = num(p)
  if (v === null) return null
  if (p.lo !== null && p.hi !== null && p.hi > p.lo) return clamp01((v - p.lo) / (p.hi - p.lo))
  if (p.unit === '%') return clamp01(v / 100)
  return null
}

// The value that says how hard the device is working (an output, a speed): drives flame
// size, rotation speed and the load bar. Prefers % or Hz; falls back to the first readout.
function drivePoint(s) {
  const usable = s.points.filter((p) => position(p) !== null)
  return usable.find((p) => p.unit === '%' || p.unit === 'Hz')
    ?? s.readouts.map((r) => r.point).find((p) => p && position(p) !== null)
    ?? null
}

// → { active, load (0–1 or null), drive }
function activity(s) {
  const drive = drivePoint(s)
  const load = drive ? position(drive) : null
  // With no running rule on the profile, a non-zero load is the best sign of activity.
  const active = !s.dim && (s.running || (s.label === 'NO RUN RULE' && load > 0))
  return { active, load, drive }
}

// Up to three values: the profile's readouts first, then measurements, then anything else.
function pickReadouts(s) {
  const chosen = s.readouts.map((r) => r.point).filter(Boolean)
  const rest = s.points.filter((p) => !chosen.includes(p))
  const ordered = [...chosen, ...rest.filter((p) => p.kind === 'measure'), ...rest.filter((p) => p.kind !== 'measure')]
  return ordered.slice(0, 3)
}

function Readout({ x, y, p, dim }) {
  const pos = position(p)
  const bad = p.quality === 2
  const label = p.key.length > 17 ? `${p.key.slice(0, 16)}…` : p.key
  return (
    <g transform={`translate(${x} ${y})`} className={`fp-readout ${bad ? 'is-bad' : ''} ${dim ? 'is-dim' : ''}`}>
      <title>{p.key}{bad ? ': outside its range' : ''}</title>
      <rect className="fp-ro-bg" x=".5" y=".5" width="121" height="51" rx="2" />
      <text className="fp-ro-label" x="7" y="13">{label}</text>
      <text className="fp-ro-value" x="115" y="30" textAnchor="end">
        {dim ? '–––' : formatValue(num(p))}{p.unit && <tspan className="fp-ro-unit" dx="3">{p.unit}</tspan>}
      </text>
      {bad && <path className="fp-ro-warn" d="M7 19h12l-6 11z" />}
      {pos !== null && (
        <>
          <rect className="fp-ro-track" x="7" y="42" width="108" height="4" />
          {!dim && <path className="fp-ro-pointer" d={`M${7 + pos * 108 - 4.5} 35h9l-4.5 6z`} />}
        </>
      )}
    </g>
  )
}

// Load bar under the equipment: how hard it is working, with the value it is read from.
function LoadBar({ load, drive, dim }) {
  if (load === null) return null
  return (
    <g className={dim ? 'is-dim' : ''}>
      <rect className="fp-ro-track" x="20" y="150" width="128" height="6" />
      {!dim && <rect className="fp-load" x="20" y="150" width={128 * load} height="6" />}
      <text className="fp-ro-label" x="20" y="170">{drive.key}</text>
      <text className="fp-ro-label" x="148" y="170" textAnchor="end">{dim ? '–' : `${formatValue(num(drive))}${drive.unit ? ` ${drive.unit}` : ''}`}</text>
    </g>
  )
}

// --- equipment --------------------------------------------------------------------------

// Fire-tube boiler / water heater: burner on the left, flame length follows the load.
function Boiler({ active, load }) {
  const flame = active ? 0.35 + 0.65 * (load ?? 0.6) : 0
  return (
    <>
      <path className="fp-pipe" d="M150 60h18M150 96h18" />
      <rect className="fp-eq" x="62" y="14" width="12" height="32" />
      <rect className="fp-eq fp-live" x="34" y="44" width="122" height="68" rx="34" />
      <rect className="fp-tube" x="34" y="69" width="92" height="18" />
      <g style={{ transform: `scaleX(${flame})`, transformOrigin: '34px 78px' }} className="fp-flame">
        <g className="fp-flicker">
          <path className="fp-flame-outer" d="M34 78C48 68 76 71 104 78C76 85 48 88 34 78Z" />
          <path className="fp-flame-inner" d="M34 78C44 73 60 74 76 78C60 82 44 83 34 78Z" />
        </g>
      </g>
      <rect className={`fp-burner ${active ? 'is-on' : ''}`} x="4" y="62" width="30" height="32" rx="2" />
      <path className="fp-d" d="M10 70h18M10 78h18M10 86h18" />
      <rect className="fp-eq" x="50" y="112" width="18" height="7" />
      <rect className="fp-eq" x="122" y="112" width="18" height="7" />
      <rect className="fp-eq" x="42" y="119" width="106" height="7" rx="1.5" />
    </>
  )
}

// Centrifugal pump: the impeller turns faster as the load rises.
function Pump({ active, load }) {
  const seconds = active ? 2.4 - 1.9 * (load ?? 0.5) : 0
  return (
    <>
      <path className="fp-pipe" d="M0 80h34M66 14v28" />
      <rect className="fp-eq" x="58" y="34" width="16" height="14" />
      <circle className="fp-eq fp-live" cx="66" cy="80" r="36" />
      <circle className="fp-eq" cx="66" cy="80" r="25" style={{ fill: 'none' }} />
      <g transform="translate(66 80)">
        <g className="fp-spin" style={{ animationDuration: `${seconds}s`, animationPlayState: active ? 'running' : 'paused' }}>
          <circle className="fp-anchor" r="24" />
          <path className="fp-d" d="M0-23c11 4 17 12 15 23M0 23c-11-4-17-12-15-23M21 11c-7 10-17 13-27 8M-21-11c7-10 17-13 27-8" />
          <circle className="fp-solid" r="4.5" />
        </g>
      </g>
      <rect className="fp-eq" x="102" y="72" width="10" height="16" />
      <rect className="fp-eq fp-live" x="112" y="60" width="48" height="40" rx="3" />
      <path className="fp-d" d="M122 64v32M131 64v32M140 64v32M149 64v32" />
      <rect className="fp-eq" x="30" y="122" width="134" height="8" rx="1.5" />
      <path className="fp-d" d="M52 116v6M80 116v6M124 100v22M148 100v22" />
    </>
  )
}

// Air handler: fan, coil and outlet air. Fan speed and the air stream follow the load.
function FanBox({ active, load }) {
  const seconds = active ? 2 - 1.6 * (load ?? 0.5) : 0
  return (
    <>
      <rect className="fp-eq fp-live" x="6" y="34" width="156" height="84" rx="4" />
      <path className="fp-d" d="M16 46l10 8M16 62l10 8M16 78l10 8M16 94l10 8" />
      <circle className="fp-eq" cx="64" cy="76" r="27" style={{ fill: 'none' }} />
      <g transform="translate(64 76)">
        <g className="fp-spin" style={{ animationDuration: `${seconds}s`, animationPlayState: active ? 'running' : 'paused' }}>
          <circle className="fp-anchor" r="22" />
          <path className="fp-d" d="M0-22c9 6 9 15 0 20M19 11c-10 2-17-4-18-13M-19 11c2-10 9-14 18-8" />
          <circle className="fp-solid" r="4" />
        </g>
      </g>
      <rect className="fp-eq" x="102" y="42" width="24" height="68" rx="2" style={{ fill: 'none' }} />
      <path className="fp-d" d="M106 46l16 8-16 8 16 8-16 8 16 8-16 8 16 8" />
      <path className={`fp-air ${active ? 'is-on' : ''}`} d="M134 58h22M134 76h22M134 94h22" />
    </>
  )
}

// A type with no drawing yet: a control panel whose lamps are its status, command and alarm points.
function Panel({ s, active }) {
  const lamps = s.points.filter((p) => p.kind !== 'measure' && num(p) !== null).slice(0, 5)
  return (
    <>
      <rect className="fp-eq fp-live" x="12" y="18" width="146" height="116" rx="5" />
      <rect className="fp-eq" x="22" y="28" width="126" height="18" rx="2" />
      <circle className={`fp-lamp ${active ? 'is-on' : ''}`} cx="34" cy="37" r="4.5" />
      <path className="fp-d" d="M46 37h92" />
      {lamps.map((p, i) => (
        <g key={p.key} transform={`translate(24 ${60 + i * 15})`}>
          <circle className={`fp-lamp ${num(p) > 0 && !s.dim ? (p.kind === 'alarm' ? 'is-alarm' : 'is-on') : ''}`} cx="5" cy="-3.5" r="4" />
          <text className="fp-ro-label" x="16" y="0">{p.key.length > 18 ? `${p.key.slice(0, 17)}…` : p.key}</text>
          <text className="fp-ro-label" x="124" y="0" textAnchor="end">{s.dim ? '–' : formatValue(num(p))}</text>
        </g>
      ))}
    </>
  )
}

const DRAWINGS = { vessel: Boiler, pump: Pump, fanbox: FanBox }

export function Faceplate({ s }) {
  const { active, load, drive } = activity(s)
  const Drawing = DRAWINGS[s.glyph]
  const readouts = pickReadouts(s)
  return (
    <svg className="faceplate" viewBox="0 0 300 176" data-active={active ? '1' : '0'} data-dim={s.dim ? '1' : '0'}
      role="img" aria-label={`${s.device.name}: ${s.label}`}>
      {Drawing ? <Drawing active={active} load={load} /> : <Panel s={s} active={active} />}
      {Drawing && <LoadBar load={load} drive={drive} dim={s.dim} />}
      {s.alarm === 'critical' && <g className="fp-alarm"><rect x="4" y="4" width="18" height="18" /><text x="13" y="18" textAnchor="middle">!</text></g>}
      {s.alarm === 'warning' && <g className="fp-alarm is-warning"><path d="M3 4h20L13 22z" /><text x="13" y="15" textAnchor="middle">!</text></g>}
      {readouts.map((p, i) => <Readout key={p.key} x={174} y={4 + i * 58} p={p} dim={s.dim} />)}
      {!s.points.length && <text className="fp-ro-label" x="235" y="90" textAnchor="middle">no data yet</text>}
    </svg>
  )
}
