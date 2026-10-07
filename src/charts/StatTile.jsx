export default function StatTile({ label, value, note, status }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {(note || status) && (
        <div className={`stat-note ${status ?? ''}`}>
          {status && <span className="status-icon">{status === 'critical' ? '⚠' : '✓'} </span>}{note}
        </div>
      )}
    </div>
  )
}
