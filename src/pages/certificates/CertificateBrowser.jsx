import { useMemo, useState } from 'react'
import { api } from '../../api.js'
import { useLoad, useAction, certificatesChanged } from '../../lib.js'
import { Badge, Empty, Errors } from '../../ui.jsx'
import ProfileChoice from './ProfileChoice.jsx'
import { initialChoice, initialNewProfile, profileDecision } from './profileDecision.js'

const STATUS_TONE = { pending: 'warn', accepted: 'ok', declined: 'neutral' }
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const lastSegment = (key) => key?.split('.').pop()

// Browses a (possibly long) list of certificates: grouped by location or by field set,
// searchable, collapsible, with bulk actions when they're pending.
export default function CertificateBrowser({ certs, status, onChanged }) {
  const [view, setView] = useState('location')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())
  const action = useAction()
  const pending = status === 'pending'

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => (q
    ? certs.filter((c) =>
        [c.device_key, c.name, c.gateway_key, c.declared_profile].some((v) => v?.toLowerCase().includes(q))
        || c.field_keys?.some((k) => k.toLowerCase().includes(q)))
    : certs), [certs, q])

  const groups = useMemo(
    () => (view === 'location' ? locationTree(visible) : fieldSetGroups(visible)),
    [view, visible],
  )

  // While searching, everything matching is shown expanded.
  const isOpen = (id) => Boolean(q) || open.has(id)
  const toggle = (id) => setOpen((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const expandAll = () => setOpen(new Set(allGroupIds(groups)))
  const collapseAll = () => setOpen(new Set())

  // Selecting a group selects every certificate in it.
  const select = (ids, on) => setSelected((s) => {
    const n = new Set(s)
    ids.forEach((id) => (on ? n.add(id) : n.delete(id)))
    return n
  })
  const selectedIds = [...selected].filter((id) => visible.some((c) => c.id === id))

  const done = () => { setSelected(new Set()); onChanged(); certificatesChanged() }

  const decline = async (ids) => {
    if (!window.confirm(`Decline ${plural(ids.length, 'certificate')}? Nothing will be created for them.`)) return
    if (await action.run(() => api.declineManyCertificates(ids))) done()
  }

  const reopen = async (ids) => {
    if (await action.run(() => api.reopenCertificates(ids))) done()
  }

  const remove = async (ids) => {
    if (!window.confirm(
      `Delete ${plural(ids.length, 'certificate')} permanently? Devices already created from them are kept. ` +
      'If a gateway sends one again (retained births are re-sent on every reconnect), it comes back as a new pending certificate.',
    )) return
    if (await action.run(() => api.deleteCertificates(ids))) done()
  }

  const ctx = { isOpen, toggle, selected, select, pending, decline, reopen, onChanged: done }

  // What the selection can do depends on the statuses in it.
  const selectedCerts = visible.filter((c) => selected.has(c.id))
  const idsWith = (st) => selectedCerts.filter((c) => c.status === st).map((c) => c.id)

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="segmented">
          <button className={view === 'location' ? 'active' : ''} onClick={() => setView('location')}>By location</button>
          <button className={view === 'fields' ? 'active' : ''} onClick={() => setView('fields')}>By field set</button>
        </div>
        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search device, gateway or field…" />
        <button className="small" onClick={expandAll}>Expand all</button>
        <button className="small" onClick={collapseAll}>Collapse all</button>
        <span className="sub">{q ? `${visible.length} of ${certs.length}` : plural(certs.length, 'certificate')}</span>
      </div>

      <Errors errors={[action.error]} />

      {visible.length === 0 && <Empty>{q ? 'Nothing matches that search.' : `No ${status || ''} certificates.`}</Empty>}

      {view === 'location' && [...groups.children.values()].map((node) => <TreeNode key={node.id} node={node} ctx={ctx} />)}
      {view === 'fields' && groups.map((g) => <FieldSetGroup key={g.id} group={g} ctx={ctx} />)}

      {selectedIds.length > 0 && (
        <div className="bulk-bar">
          <strong>{plural(selectedIds.length, 'certificate')} selected</strong>
          {idsWith('pending').length > 0 && (
            <button onClick={() => decline(idsWith('pending'))}>Decline {idsWith('pending').length}</button>
          )}
          {idsWith('declined').length > 0 && (
            <button className="primary" onClick={() => reopen(idsWith('declined'))}>Reopen {idsWith('declined').length}</button>
          )}
          <button className="danger-solid" onClick={() => remove(selectedIds)}>Delete {selectedIds.length}</button>
          <span className="spacer" />
          <button onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ grouping

// gateway → each segment of the device key except the last (site → system → …) → certificates
function locationTree(certs) {
  const root = { id: '', children: new Map(), certs: [] }
  for (const c of certs) {
    const segments = c.device_key ? c.device_key.split('.') : ['(no device key)']
    const path = [c.gateway_key ?? '(no gateway)', ...segments.slice(0, -1)]
    let node = root
    path.forEach((seg, depth) => {
      if (!node.children.has(seg)) {
        node.children.set(seg, { id: path.slice(0, depth + 1).join('/'), label: seg, depth, children: new Map(), certs: [] })
      }
      node = node.children.get(seg)
    })
    node.certs.push(c)
  }
  return root
}

// Devices reporting exactly the same property keys, largest group first.
function fieldSetGroups(certs) {
  const bySignature = new Map()
  for (const c of certs) {
    const sig = (c.field_keys ?? []).join('|')
    if (!bySignature.has(sig)) bySignature.set(sig, { id: `fields:${sig}`, keys: c.field_keys ?? [], certs: [] })
    bySignature.get(sig).certs.push(c)
  }
  return [...bySignature.values()].sort((a, b) => b.certs.length - a.certs.length || b.keys.length - a.keys.length)
}

function certsUnder(node) {
  return [...node.certs, ...[...node.children.values()].flatMap(certsUnder)]
}

function allGroupIds(groups) {
  if (Array.isArray(groups)) return groups.map((g) => g.id)
  const walk = (n) => [n.id, ...[...n.children.values()].flatMap(walk)]
  return [...groups.children.values()].flatMap(walk)
}

// ------------------------------------------------------------------ pieces

function GroupHeader({ id, depth = 0, label, certs, meta, ctx, children }) {
  const ids = certs.map((c) => c.id)
  const selectedCount = ids.filter((i) => ctx.selected.has(i)).length
  const pendingIds = certs.filter((c) => c.status === 'pending').map((c) => c.id)
  const declinedIds = certs.filter((c) => c.status === 'declined').map((c) => c.id)
  const known = certs.filter((c) => c.device_exists && c.status === 'pending').length

  return (
    <div className="group-head" style={{ paddingLeft: 8 + depth * 22 }}>
      <button className="chevron" onClick={() => ctx.toggle(id)} aria-label={ctx.isOpen(id) ? 'Collapse' : 'Expand'}>
        {ctx.isOpen(id) ? '▾' : '▸'}
      </button>
      <input type="checkbox" checked={selectedCount === ids.length}
        ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < ids.length }}
        onChange={(e) => ctx.select(ids, e.target.checked)} />
      <button className="group-label" onClick={() => ctx.toggle(id)}>{label}</button>
      <Badge>{plural(certs.length, 'device')}</Badge>
      {known > 0 && <Badge tone="info">{known} known</Badge>}
      {meta}
      <span className="spacer" />
      {children}
      {ctx.pending && pendingIds.length > 0 && (
        <button className="small danger" onClick={() => ctx.decline(pendingIds)}>Decline {pendingIds.length}</button>
      )}
      {!ctx.pending && declinedIds.length > 0 && (
        <button className="small" onClick={() => ctx.reopen(declinedIds)}>Reopen {declinedIds.length}</button>
      )}
    </div>
  )
}

function CertRow({ c, depth = 0, ctx, label }) {
  return (
    <div className="cert-row" style={{ paddingLeft: 38 + depth * 22 }}>
      <input type="checkbox" checked={ctx.selected.has(c.id)} onChange={(e) => ctx.select([c.id], e.target.checked)} />
      <a href={`#/certificates/${c.id}`} className="cert-name">
        <strong>{label ?? c.name ?? lastSegment(c.device_key) ?? 'Unidentified'}</strong>
        <span className="sub"> {c.device_key}</span>
      </a>
      <span className="spacer" />
      {c.declared_profile && <span className="sub">{c.declared_profile}</span>}
      {c.device_exists && c.status === 'pending' && <Badge tone="info">known device</Badge>}
      {c.status === 'pending' && c.review_reason && <span className="review-reason" title="Why this wasn't accepted automatically">{c.review_reason}</span>}
      {c.auto_accepted && <Badge tone="ok">auto</Badge>}
      <span className="sub">{plural(c.field_count, 'field')}</span>
      {!ctx.pending && <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>}
      <span className="sub nowrap">{new Date(c.received_at).toLocaleString()}</span>
    </div>
  )
}

function TreeNode({ node, ctx }) {
  const certs = certsUnder(node)
  return (
    <div className={node.depth === 0 ? 'group card-flat' : 'group'}>
      <GroupHeader id={node.id} depth={node.depth} label={node.label} certs={certs} ctx={ctx} />
      {ctx.isOpen(node.id) && (
        <>
          {[...node.children.values()].map((child) => <TreeNode key={child.id} node={child} ctx={ctx} />)}
          {node.certs.map((c) => (
            <CertRow key={c.id} c={c} depth={node.depth} ctx={ctx} label={c.name ?? lastSegment(c.device_key)} />
          ))}
        </>
      )}
    </div>
  )
}

function FieldSetGroup({ group, ctx }) {
  const [accepting, setAccepting] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const names = group.certs.map((c) => c.name ?? lastSegment(c.device_key))
  const preview = group.keys.slice(0, 6).join(', ') + (group.keys.length > 6 ? ', …' : '')
  const pendingCerts = group.certs.filter((c) => c.status === 'pending')

  return (
    <div className="group card-flat">
      <GroupHeader
        id={group.id}
        label={`${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`}
        certs={group.certs}
        ctx={ctx}
        meta={<span className="sub" title={group.keys.join(', ')}>{plural(group.keys.length, 'field')}: {preview}</span>}
      >
        {ctx.pending && pendingCerts.length > 0 && !accepting && (
          <button className="small primary" onClick={() => { setAccepting(true); if (!ctx.isOpen(group.id)) ctx.toggle(group.id) }}>
            Accept {pendingCerts.length}…
          </button>
        )}
      </GroupHeader>

      {ctx.isOpen(group.id) && (
        <div className="group-body">
          {accepting && (
            <GroupAccept certs={pendingCerts} onCancel={() => setAccepting(false)} onDone={ctx.onChanged} />
          )}
          <div className="field-summary">
            <button className="link" onClick={() => setShowFields((s) => !s)}>
              {showFields ? 'Hide' : 'Show'} the {plural(group.keys.length, 'field')}
            </button>
            {showFields && <div className="chips top-gap">{group.keys.map((k) => <span key={k} className="chip">{k}</span>)}</div>}
          </div>
          {group.certs.map((c) => <CertRow key={c.id} c={c} ctx={ctx} />)}
        </div>
      )}
    </div>
  )
}

// One profile decision for every device in a field-set group. Candidates come from the
// first certificate: every device in the group reports the same fields, so they match alike.
function GroupAccept({ certs, onCancel, onDone }) {
  const sample = useLoad(() => api.certificate(certs[0].id), [certs[0].id])
  const enums = useLoad(api.enums)
  const action = useAction()
  const [choice, setChoice] = useState(null)
  const [newProfile, setNewProfile] = useState(null)

  const cert = sample.data
  if (!cert) return <Errors errors={[sample.error]} />
  const currentChoice = choice ?? initialChoice(cert)
  const currentNew = newProfile ?? initialNewProfile(cert)
  const missingKeys = certs.filter((c) => !c.device_key || (!c.gateway_key && !c.device_exists))

  const accept = async (e) => {
    e.preventDefault()
    const body = { ids: certs.map((c) => c.id), profile: profileDecision(currentChoice, currentNew) }
    if (await action.run(() => api.acceptManyCertificates(body))) onDone()
  }

  return (
    <form className="subpanel stack" onSubmit={accept}>
      <p>
        Accepting creates {plural(certs.length, 'device')} (pending) with their details from each certificate.
        Devices that already exist just get any new fields as extensions.
      </p>
      {missingKeys.length > 0 && (
        <p className="error">
          {plural(missingKeys.length, 'certificate')} lack a device key or gateway; open them individually to fill those in.
        </p>
      )}
      <ProfileChoice cert={cert} choice={currentChoice} onChoice={setChoice} newProfile={currentNew}
        onNewProfile={setNewProfile} kinds={enums.data?.property_kind} devices={certs.length} />
      <Errors errors={[action.error, enums.error]} />
      <div className="form-actions">
        <button className="primary" disabled={missingKeys.length > 0}>Accept {plural(certs.length, 'device')}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

