import { profileName, show } from '../../lib.js'
import { Badge } from '../../ui.jsx'

// Pick an existing profile (ranked candidates) or build a new one from the certificate's fields.
// `devices` > 1 when the choice applies to a whole group with the same field set.
export default function ProfileChoice({ cert, choice, onChoice, newProfile, onNewProfile, kinds, devices = 1 }) {
  const chosen = cert.candidates.find((c) => String(c.id) === choice)

  return (
    <div className="stack">
      <div>
        <h3 className="label">Profile{devices > 1 && ` for all ${devices} devices`}</h3>
        <div className="choices">
          {cert.candidates.map((p) => (
            <label key={p.id} className={`choice ${choice === String(p.id) ? 'active' : ''}`}>
              <input type="radio" name={`profile-${cert.id}`} checked={choice === String(p.id)} onChange={() => onChoice(String(p.id))} />
              <div>
                <strong>{profileName(p)}</strong>{' '}
                {p.declared && <Badge tone="info">declared</Badge>} {p.exact && <Badge tone="ok">exact match</Badge>}
                <div className="sub">
                  matches {p.matched} of {cert.fields.length} fields
                  {p.extra.length > 0 && <> · {p.extra.length} become extensions</>}
                  {p.missing.length > 0 && <> · {p.missing.length} profile properties not reported</>}
                </div>
              </div>
            </label>
          ))}
          <label className={`choice ${choice === 'new' ? 'active' : ''}`}>
            <input type="radio" name={`profile-${cert.id}`} checked={choice === 'new'} onChange={() => onChoice('new')} />
            <div>
              <strong>Create a new profile</strong>
              <div className="sub">
                {cert.candidates.some((c) => c.exact) ? 'An exact match already exists; usually not needed.' : 'Build it from these fields.'}
              </div>
            </div>
          </label>
        </div>
      </div>

      {chosen && (chosen.extra.length > 0 || chosen.missing.length > 0) && (
        <div className="subpanel">
          {chosen.extra.length > 0 && (
            <p className="hint">Become extensions awaiting review{devices > 1 && ' on each device'}: <strong>{chosen.extra.join(', ')}</strong></p>
          )}
          {chosen.missing.length > 0 && (
            <p className="hint">In the profile but not reported (still created on the device): {chosen.missing.join(', ')}</p>
          )}
        </div>
      )}

      {choice === 'new' && kinds && <NewProfileEditor value={newProfile} onChange={onNewProfile} kinds={kinds} />}
    </div>
  )
}

function NewProfileEditor({ value, onChange, kinds }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  const setField = (i, k, v) => onChange({ ...value, fields: value.fields.map((f, j) => (j === i ? { ...f, [k]: v } : f)) })
  const setAll = (include) => onChange({ ...value, fields: value.fields.map((f) => ({ ...f, include })) })
  const included = value.fields.filter((f) => f.include).length

  return (
    <div className="subpanel stack">
      <div className="inline-form">
        <input value={value.key} onChange={set('key')} placeholder="New profile key, e.g. dhw-boiler" required />
        <label>Major<input type="number" value={value.major} onChange={set('major')} required /></label>
        <label>Minor<input type="number" value={value.minor} onChange={set('minor')} required /></label>
      </div>
      <p className="hint">
        {included} of {value.fields.length} fields become profile properties; unticked ones are added to the device as
        extensions awaiting review. Kind, type and writable are guessed from the names; check them.{' '}
        <button type="button" className="link" onClick={() => setAll(true)}>Tick all</button> ·{' '}
        <button type="button" className="link" onClick={() => setAll(false)}>Untick all</button>
      </p>
      <div className="table-scroll tall">
        <table>
          <thead><tr><th /><th>Key</th><th>Kind</th><th>Type</th><th>Unit</th><th>Range</th><th>Acquisition</th><th>Writable</th><th>Required</th></tr></thead>
          <tbody>
            {value.fields.map((f, i) => (
              <tr key={f.key} className={f.include ? '' : 'muted-row'}>
                <td><input type="checkbox" checked={f.include} onChange={(e) => setField(i, 'include', e.target.checked)} /></td>
                <td><strong>{f.key}</strong></td>
                <td>
                  <select value={f.kind} disabled={!f.include} onChange={(e) => setField(i, 'kind', e.target.value)}>
                    {kinds.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </td>
                <td><input className="num" value={f.type} disabled={!f.include} onChange={(e) => setField(i, 'type', e.target.value)} list="types" /></td>
                <td><input className="num" value={f.unit} disabled={!f.include} onChange={(e) => setField(i, 'unit', e.target.value)} /></td>
                <td className="sub">{f.min === undefined && f.max === undefined ? '—' : `${show(f.min)} … ${show(f.max)}`}</td>
                <td className="sub">{show(f.acquisition)}{f.deadband !== undefined && <> ±{f.deadband}</>}</td>
                <td><input type="checkbox" checked={f.writable} disabled={!f.include} onChange={(e) => setField(i, 'writable', e.target.checked)} /></td>
                <td><input type="checkbox" checked={f.required} disabled={!f.include} onChange={(e) => setField(i, 'required', e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="types"><option>bool</option><option>float</option><option>int</option><option>enum</option></datalist>
      </div>
    </div>
  )
}
