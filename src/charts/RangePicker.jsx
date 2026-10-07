import { RANGES } from './format.js'

// Time-range presets. Sits in one row above the charts it scopes.
export default function RangePicker({ value, onChange, options = RANGES }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Time range">
      {options.map((r) => (
        <button key={r.value} role="radio" aria-checked={value === r.value}
          className={value === r.value ? 'active' : ''} onClick={() => onChange(r.value)}>
          {r.label}
        </button>
      ))}
    </div>
  )
}
