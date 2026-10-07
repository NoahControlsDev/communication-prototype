import { useState } from 'react'
import { api } from '../api.js'
import { useLoad } from '../lib.js'
import { Errors } from '../ui.jsx'
import RangePicker from './RangePicker.jsx'
import TimeSeriesChart from './TimeSeriesChart.jsx'

export default function PropertyHistory({ id, onClose, title }) {
  const [range, setRange] = useState('24h')
  const history = useLoad(() => api.propertyHistory(id, range), [id, range])
  const h = history.data
  return (
    <div className="subpanel top-gap">
      <div className="card-head">
        <h3>{title ?? (h ? `History · ${h.property.key}` : 'History')}</h3>
        <div className="actions">
          <RangePicker value={range} onChange={setRange} />
          <button className="small" onClick={onClose}>Close</button>
        </div>
      </div>
      <Errors errors={[history.error]} />
      {h && <TimeSeriesChart points={h.points} unit={h.property.unit} lo={h.property.lo} hi={h.property.hi} range={range} />}
    </div>
  )
}
