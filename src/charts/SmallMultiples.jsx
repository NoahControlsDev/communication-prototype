import { useState } from 'react'
import { ResponsiveContainer, LineChart, Line, YAxis, XAxis, Tooltip } from 'recharts'
import { api } from '../api.js'
import { useLoad } from '../lib.js'
import { formatValue, formatTime, toSeries } from './format.js'
import TimeSeriesChart from './TimeSeriesChart.jsx'

export default function SmallMultiples({ deviceId, range, refresh = 0 }) {
  const series = useLoad(() => api.deviceSeries(deviceId, range), [deviceId, range, refresh])
  const [selected, setSelected] = useState(null)

  if (series.error) return <p className="error">{series.error}</p>
  if (!series.data) return <p className="sub pad">Loading charts…</p>
  const withData = series.data.filter((s) => s.points.length)
  if (!withData.length) return <p className="empty pad">No readings in this range.</p>

  return (
    <div className="multiples-wrap">
      {selected && <SelectedHistory id={selected} range={range} refresh={refresh} onClose={() => setSelected(null)} />}
      <div className="multiples">
        {withData.map((s) => (
          <MiniChart key={s.id} s={s} active={selected === s.id} onOpen={() => setSelected(s.id)} />
        ))}
      </div>
    </div>
  )
}

function MiniChart({ s, active, onOpen }) {
  const data = toSeries(s.points)
  const last = [...data].reverse().find((p) => p.v !== null)
  const outNow = last?.q === 2

  return (
    <button className={`mini ${active ? 'active' : ''}`} onClick={onOpen} title="Open full size">
      <div className="mini-head">
        <span className="mini-key">{s.key}</span>
        <span className="mini-value">
          {formatValue(last?.v)}{s.unit && <span className="sub"> {s.unit}</span>}
          {outNow && <span className="status-icon" title="out of range" aria-label="out of range"> ⚠</span>}
        </span>
      </div>
      <div className="mini-plot">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} isAnimationActive={false}
              content={({ active: a, payload }) => (a && payload?.length ? (
                <div className="chart-tooltip">
                  <strong>{formatValue(payload[0].payload.v)}</strong>{s.unit && <span className="sub"> {s.unit}</span>}
                  <div className="sub">{formatTime(payload[0].payload.t)}</div>
                  {payload[0].payload.q === 2 && <div className="tt-status">out of range</div>}
                </div>
              ) : null)} />
            <Line dataKey="v" stroke="var(--series-1)" strokeWidth={2} isAnimationActive={false}
              dot={({ cx, cy, payload, index }) => (payload?.q === 2
                ? <circle key={index} cx={cx} cy={cy} r={4} fill="var(--critical)" stroke="var(--surface)" strokeWidth={2} />
                : <g key={index} />)}
              activeDot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </button>
  )
}

function SelectedHistory({ id, range, refresh, onClose }) {
  const history = useLoad(() => api.propertyHistory(id, range), [id, range, refresh])
  const h = history.data
  return (
    <div className="subpanel">
      <div className="card-head">
        <h3>{h ? `${h.property.device_name} · ${h.property.key}` : 'Loading…'}</h3>
        <button className="small" onClick={onClose}>Close</button>
      </div>
      {history.error && <p className="error">{history.error}</p>}
      {h && <TimeSeriesChart points={h.points} unit={h.property.unit} lo={h.property.lo} hi={h.property.hi} range={range} />}
    </div>
  )
}
