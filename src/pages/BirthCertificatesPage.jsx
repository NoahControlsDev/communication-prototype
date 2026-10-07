import { useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction, go, show, certificatesChanged } from '../lib.js'
import { PageHeader, Card, Errors, Badge } from '../ui.jsx'
import CertificateBrowser from './certificates/CertificateBrowser.jsx'
import ProfileChoice from './certificates/ProfileChoice.jsx'
import { initialChoice, initialNewProfile, profileDecision } from './certificates/profileDecision.js'

export default function BirthCertificatesPage({ id }) {
  return id ? <CertificateDetail id={id} /> : <CertificateList />
}

const STATUS_TONE = { pending: 'warn', accepted: 'ok', declined: 'neutral' }
const CertStatus = ({ status }) => <Badge tone={STATUS_TONE[status]}>{status}</Badge>
const when = (t) => new Date(t).toLocaleString()

const EXAMPLE = JSON.stringify({
  gateway: 'GW-01',
  timestamp: new Date().toISOString(),
  devices: [{
    device_key: 'Site.DHW.Boiler1', name: 'DHW Boiler1', type: 'dhw-boiler@1.0',
    properties: [
      { key: 'LeavingWaterTemp', type: 'float', unit: '°C', acquisition: 'cov', deadband: 0.2, min: 0, max: 120 },
      { key: 'Output', type: 'float', unit: '%', acquisition: 'interval', min: 0, max: 100 },
      { key: 'Enable', type: 'int', acquisition: 'cov', writable: true },
    ],
  }],
}, null, 2)

function CertificateList() {
  const [status, setStatus] = useState('pending')
  const certs = useLoad(() => api.certificates(status), [status])
  const [submitting, setSubmitting] = useState(false)
  const action = useAction()
  const pendingCount = status === 'pending' ? certs.data?.length ?? 0 : 0

  const declineAll = async () => {
    if (!window.confirm(`Decline all ${pendingCount} pending certificates? Nothing will be created for them.`)) return
    if (await action.run(() => api.declineAllCertificates())) {
      certs.reload()
      certificatesChanged()
    }
  }

  return (
    <>
      <PageHeader title="Birth certificates" subtitle="Devices announcing themselves. Accepting one creates the device.">
        {pendingCount > 0 && <button className="danger" onClick={declineAll}>Decline all {pendingCount} pending</button>}
        {!submitting && <button className="primary" onClick={() => setSubmitting(true)}>Submit certificate</button>}
      </PageHeader>
      <Errors errors={[certs.error, action.error]} />

      {submitting && <SubmitCard onClose={() => setSubmitting(false)} onSubmitted={certs.reload} />}

      <div className="tabs">
        {['pending', 'accepted', 'declined', ''].map((s) => (
          <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <Card>
        {certs.data && <CertificateBrowser key={status} certs={certs.data} status={status} onChanged={certs.reload} />}
      </Card>
    </>
  )
}

function SubmitCard({ onClose, onSubmitted }) {
  const [text, setText] = useState(EXAMPLE)
  const action = useAction()

  const submit = (e) => {
    e.preventDefault()
    action.run(async () => {
      let payload
      try { payload = JSON.parse(text) } catch { throw new Error('Not valid JSON') }
      const { certificates } = await api.submitCertificate(payload)
      if (certificates.length === 1) go(`#/certificates/${certificates[0].id}`)
      else { onClose(); onSubmitted(); certificatesChanged() }
    })
  }

  return (
    <Card title="Submit certificate">
      <form className="stack" onSubmit={submit}>
        <p className="hint">
          Gateways publish this retained on <code>bas/&lt;GATEWAY_ID&gt;/birth</code> when they connect. Each entry in{' '}
          <code>devices</code> becomes one certificate. A single device object (with <code>gateway</code>) works too.
        </p>
        <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <Errors errors={[action.error]} />
        <div className="form-actions">
          <button className="primary">Submit</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Card>
  )
}

function CertificateDetail({ id }) {
  const cert = useLoad(() => api.certificate(id), [id])
  const action = useAction()
  const c = cert.data

  const reopen = async () => {
    if (await action.run(() => api.reopenCertificates([id]))) { cert.reload(); certificatesChanged() }
  }

  const remove = async () => {
    const note = c.status === 'accepted' ? ' The device it created is kept.' : ''
    if (!window.confirm(
      `Delete this certificate permanently?${note} If the gateway sends it again ` +
      '(retained births are re-sent on every reconnect), it comes back as a new pending certificate.',
    )) return
    if (await action.run(() => api.deleteCertificates([id]))) { certificatesChanged(); go('#/certificates') }
  }

  if (!c) return <Errors errors={[cert.error]} />

  return (
    <>
      <PageHeader
        title={<>{c.device_key ?? 'Unidentified device'} <CertStatus status={c.status} /></>}
        back={{ href: '#/certificates', label: 'Birth certificates' }}
      >
        {c.status === 'declined' && <button className="primary" onClick={reopen}>Reopen for review</button>}
        <button className="danger" onClick={remove}>Delete certificate</button>
      </PageHeader>
      <Errors errors={[action.error]} />

      <div className="two-col">
        <Card title="Certificate">
          <dl className="facts">
            <dt>Received</dt><dd>{when(c.received_at)}</dd>
            <dt>Topic</dt><dd>{c.topic ? <code>{c.topic}</code> : 'submitted by hand'}</dd>
            <dt>Device key</dt><dd>{show(c.device_key)}</dd>
            <dt>Gateway</dt>
            <dd>{show(c.gateway_key)} {c.gateway_key && (c.gateway ? <Badge tone="ok">exists</Badge> : <Badge tone="warn">new</Badge>)}</dd>
            <dt>Declared profile</dt><dd>{show(c.declared_profile)}</dd>
            <dt>Name</dt><dd>{show(c.name)}</dd>
            <dt>Site tag</dt><dd>{show(c.site_tag)}</dd>
          </dl>
          <details className="top-gap">
            <summary>Raw payload</summary>
            <pre>{JSON.stringify(c.payload, null, 2)}</pre>
          </details>
        </Card>

        <Card title="Decision">
          {c.status === 'pending' && c.review_reason && (
            <p className="retention-note"><span className="status-icon">⚠</span> Not accepted automatically: {c.review_reason}</p>
          )}
          {c.status === 'pending' && <Decision cert={c} onDone={cert.reload} />}
          {c.status === 'accepted' && (
            <p>{c.auto_accepted ? <>Accepted automatically: type <code>{c.declared_profile}</code> matched</> : 'Accepted'} {when(c.decided_at)}.{' '}
              {c.device_id ? <a href={`#/devices/${c.device_id}`}>Open device →</a> : '(device since deleted)'}</p>
          )}
          {c.status === 'declined' && (
            <p>Declined {when(c.decided_at)}. Nothing was created. Use <strong>Reopen for review</strong> to decide again.</p>
          )}
        </Card>
      </div>

      <Card title={`Fields (${c.fields.length})`}
        actions={c.device_key && <a className="small-link" href={`#/fields/${encodeURIComponent(c.device_key)}`}>View in Fields →</a>}>
        <div className="chips">
          {c.fields.map((f) => (
            <span key={f.key} className="chip" title={JSON.stringify(f)}>
              {f.key}
              {Object.keys(f).length > 1 && <span className="sub"> · {Object.entries(f).filter(([k]) => k !== 'key').map(([k, v]) => `${k}: ${v}`).join(', ')}</span>}
            </span>
          ))}
        </div>
      </Card>
    </>
  )
}

function Decision({ cert, onDone }) {
  const action = useAction()
  const gateways = useLoad(() => api.list('gateways'))
  const enums = useLoad(api.enums)

  const [choice, setChoice] = useState(() => initialChoice(cert))
  const [device, setDevice] = useState({
    device_key: cert.device_key ?? '', name: cert.name ?? '', site_tag: cert.site_tag ?? '', gateway_key: cert.gateway_key ?? '',
  })
  const [newProfile, setNewProfile] = useState(() => initialNewProfile(cert))
  const setD = (k) => (e) => setDevice({ ...device, [k]: e.target.value })

  const decline = async () => {
    if (await action.run(() => api.declineCertificate(cert.id))) { onDone(); certificatesChanged() }
  }

  const accept = async (e) => {
    e?.preventDefault()
    const body = { ...device }
    if (!cert.existing_device) {
      body.profile = profileDecision(choice, newProfile)
    }
    if (await action.run(() => api.acceptCertificate(cert.id, body))) { onDone(); certificatesChanged() }
  }

  if (cert.existing_device) {
    const d = cert.existing_device
    const n = d.unknown_fields.length
    return (
      <div className="stack">
        <p>
          <a href={`#/devices/${d.id}`}>{d.name}</a> already exists
          ({d.profile_key}@{d.profile_major}.{d.profile_minor}, {d.status}).
        </p>
        <p className="hint">
          {n ? <>Accepting adds {n} field(s) it doesn't have yet as extensions awaiting review: <strong>{d.unknown_fields.join(', ')}</strong></>
            : 'It already has every field in this certificate; accepting just marks it done.'}
        </p>
        <Errors errors={[action.error]} />
        <div className="form-actions">
          <button className="primary" onClick={() => accept()}>Accept</button>
          <button className="danger" onClick={decline}>Decline</button>
        </div>
      </div>
    )
  }

  const gatewayExists = gateways.data?.some((g) => g.gateway_key === device.gateway_key)

  return (
    <form className="stack" onSubmit={accept}>
      <div className="form-grid">
        <label>Device key *<input value={device.device_key} onChange={setD('device_key')} required /></label>
        <label>Name<input value={device.name} onChange={setD('name')} placeholder="defaults to the key" /></label>
        <label>Site tag<input value={device.site_tag} onChange={setD('site_tag')} /></label>
        <label>Gateway *
          <input value={device.gateway_key} onChange={setD('gateway_key')} list="gw-list" required />
          <datalist id="gw-list">{gateways.data?.map((g) => <option key={g.id}>{g.gateway_key}</option>)}</datalist>
        </label>
      </div>
      {device.gateway_key && gateways.data && !gatewayExists && (
        <p className="hint">Gateway “{device.gateway_key}” doesn't exist yet and will be created.</p>
      )}

      <ProfileChoice cert={cert} choice={choice} onChoice={setChoice} newProfile={newProfile}
        onNewProfile={setNewProfile} kinds={enums.data?.property_kind} />

      <Errors errors={[action.error, gateways.error, enums.error]} />
      <div className="form-actions">
        <button className="primary">Accept & create device</button>
        <button type="button" className="danger" onClick={decline}>Decline</button>
      </div>
    </form>
  )
}
