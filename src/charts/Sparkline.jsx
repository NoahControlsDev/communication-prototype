import { LineChart, Line, YAxis } from 'recharts'
import { toSeries } from './format.js'

// Tiny recent trend: the line in the de-emphasis gray, the current (last) point in the
// accent. The exact value sits beside it as text, so the sparkline needs no hover.
export default function Sparkline({ points, width = 84, height = 24 }) {
  const data = toSeries(points ?? []).filter((p) => p.v !== null)
  if (data.length < 2) return null
  const last = data.length - 1

  return (
    <LineChart width={width} height={height} data={data} margin={{ top: 4, right: 5, bottom: 4, left: 1 }}
      aria-hidden="true">
      <YAxis hide domain={['dataMin', 'dataMax']} />
      <Line dataKey="v" type="linear" stroke="var(--chart-muted)" strokeWidth={1.5} isAnimationActive={false}
        dot={({ cx, cy, index }) => (index === last
          ? <circle key={index} cx={cx} cy={cy} r={3} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />
          : <g key={index} />)} />
    </LineChart>
  )
}
