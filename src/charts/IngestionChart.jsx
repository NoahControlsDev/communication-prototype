import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatCount, formatTime, tickFormatter, toSeries } from './format.js'

const AXIS_TICK = { fill: 'var(--chart-muted)', fontSize: 12 }
const SERIES = [
  { key: 'stored', label: 'Stored', color: 'var(--series-1)' },
  { key: 'held', label: 'Held (not approved)', color: 'var(--series-2)' },
]

export default function IngestionChart({ stats, range, height = 200 }) {
  const [asTable, setAsTable] = useState(false)
  const data = toSeries(stats.buckets)
  const totals = Object.fromEntries(SERIES.map((s) => [s.key, data.reduce((n, b) => n + b[s.key], 0)]))
  const per = stats.bucket_seconds >= 3600 ? `${Math.round(stats.bucket_seconds / 3600)} h`
    : stats.bucket_seconds >= 60 ? `${Math.round(stats.bucket_seconds / 60)} min` : `${stats.bucket_seconds} s`

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <div className="legend">
          {SERIES.map((s) => (
            <span key={s.key} className="legend-item">
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.label} <strong>{formatCount(totals[s.key])}</strong>
            </span>
          ))}
          <span className="sub">values per {per}</span>
        </div>
        <button className="link" onClick={() => setAsTable((v) => !v)}>{asTable ? 'Show chart' : 'Show table'}</button>
      </figcaption>

      {!data.length && <p className="empty chart-empty" style={{ height }}>No data arrived in this range.</p>}

      {data.length > 0 && !asTable && (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} padding={{ left: 8, right: 8 }}
                tickFormatter={tickFormatter(range)} tick={AXIS_TICK} tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }} minTickGap={40} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} allowDecimals={false}
                tickFormatter={formatCount} />
              <Tooltip content={<StackTooltip />} cursor={{ fill: 'var(--hover)' }} isAnimationActive={false} />
              <Bar dataKey="stored" stackId="a" fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1}
                maxBarSize={24} isAnimationActive={false} />
              <Bar dataKey="held" stackId="a" fill="var(--series-2)" stroke="var(--surface)" strokeWidth={1}
                maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.length > 0 && asTable && (
        <div className="table-scroll" style={{ maxHeight: height + 40, overflowY: 'auto' }}>
          <table className="compact numeric">
            <thead><tr><th>From</th>{SERIES.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>
              {[...data].reverse().map((b) => (
                <tr key={b.t}><td className="sub">{formatTime(b.t)}</td>{SERIES.map((s) => <td key={s.key}>{formatCount(b[s.key])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}

function StackTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="chart-tooltip">
      {SERIES.map((s) => (
        <div key={s.key} className="tt-row">
          <span className="tt-key" style={{ background: s.color }} />
          <strong>{formatCount(b[s.key])}</strong> <span className="sub">{s.label.toLowerCase()}</span>
        </div>
      ))}
      <div className="sub">{formatTime(b.t)}</div>
    </div>
  )
}
