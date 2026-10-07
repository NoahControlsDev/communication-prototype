import { useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction, go, profileName, show } from '../lib.js'
import { PageHeader, Card, Errors, Empty, Badge } from '../ui.jsx'
import PropertyForm from './PropertyForm.jsx'
import { Glyph } from '../plant/glyphs.jsx'
import { GLYPH_NAMES } from '../plant/model.js'

export default function ProfilesPage({ id }) {
  return id ? <ProfileDetail id={id} /> : <ProfileList />
}

function ProfileForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial ?? { key: '', major: 1, minor: 0 })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const ok = await onSubmit({ key: form.key, major: form.major, minor: form.minor })
    if (ok && !initial) setForm({ key: '', major: 1, minor: 0 })
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input value={form.key} onChange={set('key')} placeholder="Profile key, e.g. vfd-pump" required />
      <label>Major<input type="number" value={form.major} onChange={set('major')} required /></label>
      <label>Minor<input type="number" value={form.minor} onChange={set('minor')} required /></label>
      <button className="primary">{submitLabel}</button>
    </form>
  )
}

function ProfileList() {
  const profiles = useLoad(api.profiles)
  const action = useAction()

  const create = (body) => action.run(async () => {
    const p = await api.createProfile(body)
    go(`#/profiles/${p.id}`)
  })

  return (
    <>
      <PageHeader title="Profiles" subtitle="Device types. A device gets its standard fields from its profile." />
      <Errors errors={[profiles.error, action.error]} />
      <Card title="New profile">
        <ProfileForm onSubmit={create} submitLabel="Create" />
        <p className="hint">Minor = optional properties added · major = rename, remove or unit change (§2.1)</p>
      </Card>
      <Card>
        {profiles.data?.length === 0 && <Empty>No profiles yet.</Empty>}
        {profiles.data?.length > 0 && (
          <table>
            <thead><tr><th>Device type</th><th>Properties</th><th>Devices</th><th>Birth certificates</th></tr></thead>
            <tbody>
              {profiles.data.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => go(`#/profiles/${p.id}`)}>
                  <td><strong>{profileName(p)}</strong></td>
                  <td>{p.property_count}</td>
                  <td>{p.device_count}</td>
                  <td>{p.auto_accept ? <Badge tone="ok">auto-accept</Badge> : <Badge>manual review</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}

// How the Plant page draws devices of this type: glyph, which property means running,
// and two readouts. Stored as profile.display (config, not code).
function DisplayEditor({ display, keys, onSave }) {
  const [d, setD] = useState(() => ({
    glyph: display?.glyph ?? 'generic',
    run: display?.run ?? '',
    op: display?.when?.op ?? 'gt',
    value: String(display?.when?.value ?? 0),
    r1: display?.readouts?.[0] ?? '',
    r2: display?.readouts?.[1] ?? '',
  }))
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value })
  const keySelect = (k, blank) => (
    <select value={d[k]} onChange={set(k)}>
      <option value="">{blank}</option>
      {keys.map((key) => <option key={key}>{key}</option>)}
    </select>
  )

  const save = (e) => {
    e.preventDefault()
    onSave({
      glyph: d.glyph,
      ...(d.run && { run: d.run, when: { op: d.op, value: Number(d.value) } }),
      readouts: [d.r1, d.r2].filter(Boolean),
    })
  }

  return (
    <form className="display-editor" onSubmit={save}>
      <div className="display-preview"><Glyph name={d.glyph} /></div>
      <div className="form-grid grow">
        <label>Glyph
          <select value={d.glyph} onChange={set('glyph')}>
            {GLYPH_NAMES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label>Running when{keySelect('run', '— no running rule —')}</label>
        <label>is
          <select value={d.op} onChange={set('op')} disabled={!d.run}>
            <option value="gt">greater than</option>
            <option value="eq">equal to</option>
            <option value="ne">not equal to</option>
          </select>
        </label>
        <label>Value<input type="number" step="any" value={d.value} onChange={set('value')} disabled={!d.run} /></label>
        <label>Readout 1{keySelect('r1', '— first property —')}</label>
        <label>Readout 2{keySelect('r2', '— second property —')}</label>
        <div className="form-actions span-all"><button className="primary">Save display</button></div>
      </div>
    </form>
  )
}

function ProfileDetail({ id }) {
  const profiles = useLoad(api.profiles)
  const properties = useLoad(() => api.properties(id), [id])
  const enums = useLoad(api.enums)
  const action = useAction()
  const [editing, setEditing] = useState(null) // property id, or 'new'

  const profile = profiles.data?.find((p) => p.id === id)
  const reload = () => { profiles.reload(); properties.reload() }

  const saveProfile = (body) => action.run(async () => { await api.updateProfile(id, body); profiles.reload() })

  const deleteProfile = async () => {
    if (!window.confirm(`Delete ${profileName(profile)} and all its properties?`)) return
    if (await action.run(() => api.deleteProfile(id))) go('#/profiles')
  }

  const saveProperty = (body) => action.run(async () => {
    if (editing === 'new') await api.createProperty(id, body)
    else await api.updateProperty(editing, body)
    setEditing(null)
    reload()
  })

  const deleteProperty = async (p) => {
    if (!window.confirm(`Delete property ${p.key}? Devices lose it too, with its readings.`)) return
    if (await action.run(() => api.deleteProperty(p.id))) reload()
  }

  if (profiles.data && !profile) return <Errors errors={['Profile not found']} />
  if (!profile) return null

  const editingProperty = properties.data?.find((p) => p.id === editing)

  return (
    <>
      <PageHeader title={profileName(profile)} back={{ href: '#/profiles', label: 'Profiles' }}>
        <button className="danger" onClick={deleteProfile}>Delete profile</button>
      </PageHeader>
      <Errors errors={[profiles.error, properties.error, enums.error, action.error]} />

      <Card title="Profile">
        <ProfileForm key={profile.id} initial={profile} onSubmit={saveProfile} submitLabel="Save" />
        <div className="auto-accept top-gap">
          <label className="inline-check">
            <input type="checkbox" checked={profile.auto_accept}
              onChange={(e) => saveProfile({ auto_accept: e.target.checked })} />
            Auto-accept devices of this type
          </label>
          <p className="hint">
            A birth certificate declaring <code>"type": "{profileName(profile)}"</code> that reports every required
            property (and matches their units and types) becomes a new device instantly, with no review.
            Extra fields become extensions awaiting review.
          </p>
        </div>
        {profile.device_count > 0 && (
          <p className="hint">
            Used by {profile.device_count} device(s). New properties reach them when you press
            “Sync from profile” on the device.
          </p>
        )}
      </Card>

      <Card
        title={`Properties (${properties.data?.length ?? 0})`}
        actions={editing === null && <button className="primary" onClick={() => setEditing('new')}>Add property</button>}
      >
        {editing !== null && enums.data && (
          <div className="subpanel">
            <h3>{editing === 'new' ? 'New property' : `Edit ${editingProperty?.key}`}</h3>
            <PropertyForm key={editing} enums={enums.data} initial={editingProperty}
              onSubmit={saveProperty} onCancel={() => setEditing(null)} />
          </div>
        )}
        {properties.data?.length === 0 && editing === null && <Empty>No properties yet.</Empty>}
        {properties.data?.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Key</th><th>Kind</th><th>Type</th><th>Unit</th><th>Range</th>
                  <th>Acquisition</th><th>Flags</th><th>Tags</th><th /></tr>
              </thead>
              <tbody>
                {properties.data.map((p) => (
                  <tr key={p.id} className={editing === p.id ? 'selected' : ''}>
                    <td><strong>{p.key}</strong></td>
                    <td>{p.kind}{p.priority && <> · {p.priority}</>}</td>
                    <td>{p.type}</td>
                    <td>{show(p.unit)}</td>
                    <td>{p.min === null && p.max === null ? '—' : `${show(p.min)} … ${show(p.max)}`}</td>
                    <td>{show(p.acquisition)}{p.deadband !== null && <> ±{p.deadband}</>}</td>
                    <td className="flags">
                      {p.required && <Badge>required</Badge>}
                      {p.writable && <Badge tone="info">writable</Badge>}
                      {p.derived && <Badge>derived</Badge>}
                    </td>
                    <td>{show(p.haystack_tags)}</td>
                    <td className="row-actions">
                      <button className="small" onClick={() => setEditing(p.id)}>Edit</button>
                      <button className="small danger" onClick={() => deleteProperty(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {properties.data && (
        <Card title="Plant display">
          <DisplayEditor key={JSON.stringify(profile.display)} display={profile.display}
            keys={properties.data.map((p) => p.key)} onSave={(display) => saveProfile({ display })} />
        </Card>
      )}
    </>
  )
}
