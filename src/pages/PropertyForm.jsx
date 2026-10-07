import { useState } from 'react'

const EMPTY = {
  key: '', kind: 'measure', type: 'float', unit: '', min: '', max: '',
  aggregation: '', derived: false, formula: '', acquisition: '', deadband: '',
  writable: false, priority: '', enum_map: '', required: true, haystack_tags: '',
}

// A saved property → form strings (null → '', objects → JSON, tags → comma list).
function toForm(p) {
  if (!p) return EMPTY
  const form = { ...EMPTY }
  for (const k of Object.keys(EMPTY)) {
    const v = p[k]
    if (v === null || v === undefined) continue
    form[k] = k === 'enum_map' ? JSON.stringify(v)
      : k === 'haystack_tags' ? v.join(', ')
      : typeof v === 'number' ? String(v)
      : v
  }
  return form
}

// Create (no `initial`) or edit (with `initial`) a profile property.
export default function PropertyForm({ enums, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toForm(initial))
  const [jsonError, setJsonError] = useState('')
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    let enumMap = null
    if (form.enum_map.trim()) {
      try { enumMap = JSON.parse(form.enum_map) } catch { return setJsonError('enum_map is not valid JSON') }
    }
    setJsonError('')
    const tags = form.haystack_tags.split(',').map((t) => t.trim()).filter(Boolean)
    const ok = await onSubmit({
      ...form,
      priority: form.kind === 'alarm' ? form.priority : '', // DB rule: alarms only
      enum_map: enumMap,
      haystack_tags: tags,
    })
    if (ok && !initial) setForm(EMPTY)
  }

  const select = (k, options, allowBlank) => (
    <select value={form[k]} onChange={set(k)}>
      {allowBlank && <option value="">—</option>}
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>Key *<input value={form.key} onChange={set('key')} required placeholder="e.g. speed" /></label>
      <label>Kind *{select('kind', enums.property_kind)}</label>
      <label>Type *
        <input value={form.type} onChange={set('type')} required list="types" />
        <datalist id="types"><option>bool</option><option>float</option><option>int</option><option>enum</option></datalist>
      </label>
      <label>Unit<input value={form.unit} onChange={set('unit')} placeholder="e.g. %, °C" /></label>
      <label>Min<input type="number" step="any" value={form.min} onChange={set('min')} /></label>
      <label>Max<input type="number" step="any" value={form.max} onChange={set('max')} /></label>
      <label>Aggregation{select('aggregation', enums.aggregation, true)}</label>
      <label>Acquisition{select('acquisition', enums.acquisition, true)}</label>
      <label>Deadband<input type="number" step="any" value={form.deadband} onChange={set('deadband')} /></label>
      <label>Priority
        <input value={form.priority} onChange={set('priority')} disabled={form.kind !== 'alarm'}
          placeholder={form.kind === 'alarm' ? 'ISA-18.2' : 'alarms only'} />
      </label>
      <label className="span-2">Formula<input value={form.formula} onChange={set('formula')} /></label>
      <label className="span-2">Haystack tags
        <input value={form.haystack_tags} onChange={set('haystack_tags')} placeholder="pump, speed, sensor" />
      </label>
      <label className="span-2">Enum map (JSON)
        <input value={form.enum_map} onChange={set('enum_map')} placeholder='{"0": "off", "1": "on"}' />
      </label>
      <div className="checks span-all">
        <label><input type="checkbox" checked={form.writable} onChange={set('writable')} /> Writable</label>
        <label><input type="checkbox" checked={form.required} onChange={set('required')} /> Required</label>
        <label><input type="checkbox" checked={form.derived} onChange={set('derived')} /> Derived</label>
      </div>
      {jsonError && <p className="error span-all">{jsonError}</p>}
      <div className="form-actions span-all">
        <button className="primary">{initial ? 'Save property' : 'Add property'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
