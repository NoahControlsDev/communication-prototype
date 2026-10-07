import { useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction } from '../lib.js'
import { PageHeader, Card, Errors, Empty, Badge } from '../ui.jsx'

// Systems and gateways: one text field each, so one page component serves both.
export default function LookupPage({ title, subtitle, resource, field, column, placeholder }) {
  const rows = useLoad(() => api.list(resource), [resource])
  const action = useAction()
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(null) // { id, value }
  const hasStatus = resource === 'gateways'

  const create = async (e) => {
    e.preventDefault()
    if (await action.run(() => api.create(resource, { [field]: value }))) {
      setValue('')
      rows.reload()
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (await action.run(() => api.update(resource, editing.id, { [field]: editing.value }))) {
      setEditing(null)
      rows.reload()
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row[field]}?`)) return
    if (await action.run(() => api.remove(resource, row.id))) rows.reload()
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Errors errors={[rows.error, action.error]} />

      <Card>
        <form className="inline-form" onSubmit={create}>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} required />
          <button className="primary">Add</button>
        </form>
      </Card>

      <Card>
        {rows.data?.length === 0 && <Empty>Nothing here yet.</Empty>}
        {rows.data?.length > 0 && (
          <table>
            <thead><tr><th>{column ?? field}</th>{hasStatus && <th>Connection</th>}<th>Devices</th><th /></tr></thead>
            <tbody>
              {rows.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    {editing?.id === row.id ? (
                      <form className="inline-form" onSubmit={save}>
                        <input autoFocus value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
                        <button className="primary small">Save</button>
                        <button type="button" className="small" onClick={() => setEditing(null)}>Cancel</button>
                      </form>
                    ) : resource === 'systems' ? <a href={`#/systems/${row.id}`}>{row[field]}</a> : row[field]}
                  </td>
                  {hasStatus && <td><ConnectionBadge row={row} /></td>}
                  <td>{row.device_count}</td>
                  <td className="row-actions">
                    <button className="small" onClick={() => setEditing({ id: row.id, value: row[field] })}>Rename</button>
                    <button className="small danger" onClick={() => remove(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}

// Gateway connection from bas/<GATEWAY_ID>/status (birth = online, Last Will = offline).
function ConnectionBadge({ row }) {
  if (!row.status) return <span className="sub">never connected</span>
  return (
    <>
      <Badge tone={row.status === 'online' ? 'ok' : 'danger'}>{row.status}</Badge>
      <span className="sub"> since {new Date(row.status_at).toLocaleString()}</span>
    </>
  )
}
