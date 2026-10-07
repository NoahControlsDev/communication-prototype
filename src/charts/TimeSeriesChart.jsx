import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { formatValue, formatTime, tickFormatter, toSeries } from './format.js'

const AXIS_TICK = { fill: 'var(--chart-muted)', fontSize: 12 }

export default function TimeSeriesChart({ points, unit, lo, hi, range, height = 260, title }) {
  const [asTable, setAsTable] = useState(false)
  const data = toSeries(points)

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <div>
          {title && <strong>{title}</strong>}
          <span className="sub">
            {' '}{unit ? `${unit} · ` : ''}
            {lo !== null || hi !== null ? `range ${formatValue(lo)} … ${formatValue(hi)}` : 'no declared range'}
          </span>
        </div>
        <button className="link" onClick={() => setAsTable((v) => !v)}>{asTable ? 'Show chart' : 'Show table'}</button>
      </figcaption>

      {!data.length && <p className="empty chart-empty" style={{ height }}>No readings in this range.</p>}

      {data.length > 0 && !asTable && (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']}
                tickFormatter={tickFormatter(range)} tick={AXIS_TICK} tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }} minTickGap={40} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52}
                domain={['auto', 'auto']} tickFormatter={formatValue} />
              {lo !== null && <ReferenceLine y={lo} stroke="var(--chart-axis)" ifOverflow="discard"
                label={{ value: `min ${formatValue(lo)}`, position: 'insideBottomRight', fill: 'var(--chart-muted)', fontSize: 11 }} />}
              {hi !== null && <ReferenceLine y={hi} stroke="var(--chart-axis)" ifOverflow="discard"
                label={{ value: `max ${formatValue(hi)}`, position: 'insideTopRight', fill: 'var(--chart-muted)', fontSize: 11 }} />}
              <Tooltip content={<ValueTooltip unit={unit} />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
                isAnimationActive={false} />
              <Line dataKey="v" type="linear" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round"
                strokeLinejoin="round" isAnimationActive={false} connectNulls={false}
                dot={<OutOfRangeDot />}
                activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.length > 0 && asTable && <ValueTable data={data} unit={unit} height={height} />}
    </figure>
  )
}

function OutOfRangeDot({ cx, cy, payload, index }) {
  if (payload?.q !== 2 || cx == null || cy == null) return <g key={index} />
  return <circle key={index} cx={cx} cy={cy} r={4} fill="var(--critical)" stroke="var(--surface)" strokeWidth={2} />
}

function ValueTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tooltip">
      <div className="tt-row">
        <span className="tt-key" style={{ background: 'var(--series-1)' }} />
        <strong>{formatValue(p.v)}</strong>{unit && <span className="sub"> {unit}</span>}
      </div>
      <div className="sub">{formatTime(p.t)}</div>
      {p.n > 1 && <div className="sub">avg of {p.n} readings ({formatValue(Number(p.min))} … {formatValue(Number(p.max))})</div>}
      {p.q === 2 && <div className="tt-status">out of range</div>}
    </div>
  )
}

function ValueTable({ data, unit, height }) {
  return (
    <div className="table-scroll" style={{ maxHeight: height + 40, overflowY: 'auto' }}>
      <table className="compact numeric">
        <thead><tr><th>Time</th><th>Value{unit ? ` (${unit})` : ''}</th><th>Readings</th><th>Quality</th></tr></thead>
        <tbody>
          {[...data].reverse().map((p) => (
            <tr key={p.t}>
              <td className="sub">{formatTime(p.t)}</td>
              <td>{formatValue(p.v)}</td>
              <td className="sub">{p.n ?? 1}</td>
              <td>{p.q === 2 ? <span className="tt-status">out of range</span> : <span className="sub">good</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
