import { Fragment, useMemo, useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction, ago, until, show } from '../lib.js'
import { PageHeader, Card, Errors, Empty, Badge } from '../ui.jsx'
import PropertyHistory from '../charts/PropertyHistory.jsx'
import { formatValue } from '../charts/format.js'

// Every field (gateway → device → key) in one place, whatever its state, with the
// actions that apply to it. Birth certificates remain the review workflow; this is
// where fields are looked at.

const STATES = {
  accepted:     { label: 'Accepted',     tone: 'ok' },
  not_approved: { label: 'Not approved', tone: 'warn' },
  declined:     { label: 'Declined',     tone: 'neutral' },
}
const WHY = {
  awaiting_review:      'extension awaiting review',
  unknown_property:     'not on the device',
  unknown_device:       'device not registered',
  gateway_mismatch:     'device is on another gateway',
  pending_certificate:  'birth certificate pending',
  declined_rule:        'declined on the Data page',
  declined_certificate: 'birth certificate declined',
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export default function FieldsPage({ search }) {
  const fields = useLoad(api.fields)
  const [state, setState] = useState('')
  const [gateway, setGateway] = useState('')
  const [query, setQuery] = useState(search ? decodeURIComponent(search) : '')
  const [open, setOpen] = useState(() => new Set())
  const [charted, setCharted] = useState(null)
  const action = useAction()

  const all = useMemo(() => fields.data ?? [], [fields.data])
  const q = query.trim().toLowerCase()
  const gateways = [...new Set(all.map((f) => f.gateway_key))]
  const counts = all.reduce((m, f) => ({ ...m, [f.state]: (m[f.state] ?? 0) + 1 }), {})

  const visible = useMemo(() => all.filter((f) =>
    (!state || f.state === state) && (!gateway || f.gateway_key === gateway)
    && (!q || [f.key, f.device_key, f.device_name, f.gateway_key, f.device_type, f.meta.unit]
      .some((v) => v?.toLowerCase().includes(q)))), [all, state, gateway, q])

  // gateway|device → fields
  const devices = useMemo(() => {
    const m = new Map()
    for (const f of visible) {
      const k = `${f.gateway_key}|${f.device_key}`
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(f)
    }
    return [...m.values()]
  }, [visible])

  const isOpen = (k) => Boolean(q) || devices.length <= 3 || open.has(k)
  const toggle = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const run = async (fn) => { if (await action.run(fn)) fields.reload() }
  const ops = {
    approve: (f) => run(() => api.approveField({ gateway_key: f.gateway_key, device_key: f.device_key, key: f.key })),
    decline: (f, wholeDevice) => {
      const what = wholeDevice ? `the whole device ${f.device_key}` : `${f.device_key} · ${f.key}`
      if (!window.confirm(`Decline ${what}? Held values are deleted and new ones won't be saved. Undo is available here.`)) return
      run(() => api.declineData({ gateway_key: f.gateway_key, device_key: f.device_key, ...(wholeDevice ? {} : { key: f.key }) }))
    },
    undo: (f) => run(() => api.undeclineData(f.declined_rule_id)),
    chart: (f) => setCharted((c) => (c === f.id ? null : f.id)),
  }

  return (
    <>
      <PageHeader title="Fields" subtitle="Every point a gateway has reported, with its state.">
        <button onClick={fields.reload}>Refresh</button>
      </PageHeader>
      <Errors errors={[fields.error, action.error]} />

      <div className="filter-row">
        <div className="segmented">
          <button className={!state ? 'active' : ''} onClick={() => setState('')}>All {all.length}</button>
          {Object.entries(STATES).map(([s, def]) => (
            <button key={s} className={state === s ? 'active' : ''} onClick={() => setState(s)}>
              {def.label} {counts[s] ?? 0}
            </button>
          ))}
        </div>
        <select value={gateway} onChange={(e) => setGateway(e.target.value)}>
          <option value="">All gateways</option>
          {gateways.map((g) => <option key={g}>{g}</option>)}
        </select>
        <input className="search grow" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search field, device, gateway, type or unit…" />
        <button className="small" onClick={() => setOpen(new Set(devices.map((d) => `${d[0].gateway_key}|${d[0].device_key}`)))}>Expand all</button>
        <button className="small" onClick={() => setOpen(new Set())}>Collapse all</button>
      </div>

      <Card>
        {fields.data && !visible.length && <Empty>{all.length ? 'No fields match.' : 'No fields yet: they appear once a gateway sends a birth or data.'}</Empty>}
        {visible.length > 0 && (
          <p className="sub fields-count">{plural(visible.length, 'field')} on {plural(devices.length, 'device')}</p>
        )}
        {devices.map((list) => {
          const f0 = list[0]
          const k = `${f0.gateway_key}|${f0.device_key}`
          return (
            <DeviceFields key={k} fields={list} open={isOpen(k)} onToggle={() => toggle(k)}
              ops={ops} charted={charted} />
          )
        })}
      </Card>
    </>
  )
}

function DeviceFields({ fields, open, onToggle, ops, charted }) {
  const f0 = fields[0]
  const byState = fields.reduce((m, f) => ({ ...m, [f.state]: (m[f.state] ?? 0) + 1 }), {})
  const cert = fields.find((f) => f.certificate)?.certificate
  const canDeclineDevice = fields.some((f) => f.state === 'not_approved') && !f0.device_id

  return (
    <div className="group card-flat top-gap">
      <div className="group-head">
        <button className="chevron" onClick={onToggle}>{open ? '▾' : '▸'}</button>
        <button className="group-label" onClick={onToggle}>{f0.device_name ?? f0.device_key.split('.').pop()}</button>
        <span className="sub">{f0.device_key}</span>
        <span className="sub">on {f0.gateway_key}</span>
        {f0.device_type && <Badge tone="info">{f0.device_type}</Badge>}
        {Object.entries(byState).map(([s, n]) => <Badge key={s} tone={STATES[s].tone}>{n} {STATES[s].label.toLowerCase()}</Badge>)}
        <span className="spacer" />
        {f0.device_id && <a className="small-link" href={`#/devices/${f0.device_id}`}>Device →</a>}
        {cert && <a className="small-link" href={`#/certificates/${cert.id}`}>Certificate →</a>}
        {canDeclineDevice && <button className="small danger" onClick={() => ops.decline(f0, true)}>Decline device</button>}
      </div>
      {open && (
        <div className="table-scroll">
          <table className="compact indent">
            <thead>
              <tr><th>Field</th><th>State</th><th>Type</th><th>Unit</th><th>Range</th><th>Acquisition</th><th>Latest</th><th /></tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <Fragment key={f.id}>
                  <FieldRow f={f} ops={ops} charted={charted === f.id} />
                  {charted === f.id && (
                    <tr className="chart-row"><td colSpan={8}>
                      <PropertyHistory id={f.device_property_id} onClose={() => ops.chart(f)}
                        title={`${f.device_name ?? f.device_key} · ${f.key}`} />
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FieldRow({ f, ops, charted }) {
  const m = f.meta
  const range = m.lo == null && m.hi == null ? '—' : `${formatValue(m.lo)} … ${formatValue(m.hi)}`
  const canApprove = f.state === 'not_approved' && f.device_id
  const needsCertificate = f.state === 'not_approved' && !f.device_id

  return (
    <tr className={charted ? 'selected' : ''}>
      <td>
        <strong>{f.key}</strong>
        {f.source === 'extension' && <span className="sub"> · extension</span>}
      </td>
      <td className="nowrap">
        <Badge tone={STATES[f.state].tone}>{STATES[f.state].label}</Badge>
        {f.why && <div className="sub">{WHY[f.why] ?? f.why}</div>}
      </td>
      <td>{show(m.type)}{m.kind && <span className="sub"> · {m.kind}</span>}</td>
      <td>{show(m.unit)}</td>
      <td className="sub">{range}</td>
      <td className="sub">{show(m.acquisition)}{m.deadband != null && <> ±{m.deadband}</>}</td>
      <td className="nowrap">
        {f.last ? (
          <span title={new Date(f.last.time).toLocaleString()}>
            {typeof f.last.value === 'number' ? formatValue(f.last.value) : JSON.stringify(f.last.value)}
            {m.unit && <span className="sub"> {m.unit}</span>}
            {f.last.quality === 2 && <> <Badge tone="danger">out of range</Badge></>}
            <span className="sub"> {ago(f.last.time)}</span>
          </span>
        ) : <span className="sub">{f.state === 'declined' ? 'not saved' : 'no data'}</span>}
        {f.held_count > 0 && (
          <div className="expiry" title="Not approved values are deleted after 24 hours">
            {plural(f.held_count, 'value')} held · deleting {until(f.expires_at)}
          </div>
        )}
      </td>
      <td className="row-actions">
        {f.state === 'accepted' && f.last && !f.last.held && (
          <button className={`small ${charted ? 'primary' : ''}`} onClick={() => ops.chart(f)}>Chart</button>
        )}
        {canApprove && <button className="small primary" onClick={() => ops.approve(f)}>Approve</button>}
        {needsCertificate && f.certificate && <a className="small-link" href={`#/certificates/${f.certificate.id}`}>Review →</a>}
        {f.state === 'not_approved' && <button className="small danger" onClick={() => ops.decline(f, false)}>Decline</button>}
        {f.why === 'declined_rule' && <button className="small" onClick={() => ops.undo(f)}>Undo</button>}
        {f.why === 'declined_certificate' && f.certificate && (
          <a className="small-link" href={`#/certificates/${f.certificate.id}`}>Reopen →</a>
        )}
      </td>
    </tr>
  )
}
