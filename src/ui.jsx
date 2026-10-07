export const COMPANY = 'Noah Controls'

const SECTION = {
  systems: 'Systems', devices: 'Devices', gateways: 'Gateways',
  certificates: 'Commissioning', fields: 'Commissioning', profiles: 'Commissioning',
  plant: 'Monitoring', data: 'Monitoring',
}
const currentSection = () => SECTION[window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'devices']

export function PageHeader({ title, subtitle, back, crumbs, current, children }) {
  const trail = crumbs ?? (back ? [back] : [])
  const here = current ?? (typeof title === 'string' ? title : null)
  return (
    <header className="page-header">
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>{COMPANY}</span>
        {trail.map((c) => <span key={c.href + c.label} className="crumb"><span className="sep">/</span><a href={c.href}>{c.label}</a></span>)}
        {here && <span className="crumb"><span className="sep">/</span><span className="current">{here}</span></span>}
      </nav>
      <div className="page-head-row">
        <div>
          <div className="eyebrow">{currentSection()}</div>
          <h1>{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        <div className="actions">{children}</div>
      </div>
    </header>
  )
}

export function Card({ title, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          <h2>{title}</h2>
          <div className="actions">{actions}</div>
        </div>
      )}
      {children}
    </section>
  )
}

export function Errors({ errors }) {
  const shown = errors.filter(Boolean)
  return shown.map((e, i) => <p key={i} className="error">{e}</p>)
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export const StatusBadge = ({ status }) => (
  <Badge tone={status === 'commissioned' ? 'ok' : 'warn'}>{status === 'pending' ? 'not placed' : status}</Badge>
)

export const GatewayDot = ({ status }) => (
  <span className={`dot ${status === 'online' ? 'ok' : status === 'offline' ? 'danger' : ''}`}
    title={status ?? 'never connected'} />
)

export const Empty = ({ children }) => <p className="empty">{children}</p>
