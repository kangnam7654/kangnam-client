import { useAppStore } from '../../stores/app-store'

export function StatusBar() {
  const { sessionMeta, sessionCost, rateLimit, currentSessionId } = useAppStore()

  return (
    <div
      style={{
        height: 'var(--status-bar-height)',
        minHeight: 'var(--status-bar-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        background: 'var(--bg-activity-bar)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: currentSessionId ? 'var(--success)' : 'var(--text-muted)',
          }}
        />
        <span>{currentSessionId ? 'connected' : 'disconnected'}</span>
      </span>

      {sessionMeta && (
        <>
          <Sep />
          <span>{sessionMeta.model}</span>
        </>
      )}

      {sessionCost?.cost_usd != null && (
        <>
          <Sep />
          <span>${sessionCost.cost_usd.toFixed(3)}</span>
        </>
      )}

      {sessionCost?.num_turns != null && (
        <>
          <Sep />
          <span>{sessionCost.num_turns} turns</span>
        </>
      )}

      {rateLimit && rateLimit.utilization != null && (
        <>
          <Sep />
          <RateBar status={rateLimit.status} utilization={rateLimit.utilization} />
        </>
      )}

      <div style={{ flex: 1 }} />

      {sessionMeta?.cwd && (
        <span style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sessionMeta.cwd.replace(/^\/Users\/[^/]+/, '~')}
        </span>
      )}

      {sessionMeta?.permission_mode && (
        <>
          <Sep />
          <span>{sessionMeta.permission_mode}</span>
        </>
      )}
    </div>
  )
}

function Sep() {
  return <span style={{ color: 'var(--border-light)' }}>|</span>
}

function RateBar({ status, utilization }: { status: string; utilization: number }) {
  const pct = Math.round(utilization * 100)
  const color = status === 'rejected' ? 'var(--danger)' : status === 'allowed_warning' ? 'var(--warning)' : 'var(--success)'

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 2, background: color }} />
      </span>
      <span style={{ color }}>{pct}%</span>
    </span>
  )
}
