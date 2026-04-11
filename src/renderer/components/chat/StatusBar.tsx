import { useAppStore } from '../../stores/app-store'

export function StatusBar() {
  const { sessionMeta, sessionCost, rateLimits } = useAppStore()
  const rateLimit = Object.values(rateLimits)[0] ?? null

  if (!sessionMeta) return null

  return (
    <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-1.5 text-[11px] text-[var(--text-tertiary)]">
      <span className="font-medium">{sessionMeta.model}</span>

      {sessionCost?.cost_usd != null && (
        <>
          <Separator />
          <span>${sessionCost.cost_usd.toFixed(4)}</span>
        </>
      )}

      {sessionCost?.num_turns != null && (
        <>
          <Separator />
          <span>{sessionCost.num_turns} turns</span>
        </>
      )}

      {rateLimit && (
        <>
          <Separator />
          <RateLimitBadge status={rateLimit.status} utilization={rateLimit.utilization} />
        </>
      )}

      <div className="flex-1" />

      <span className="text-[var(--text-muted)]">v{sessionMeta.claude_code_version}</span>
    </div>
  )
}

function Separator() {
  return <span className="text-[var(--text-muted)]">|</span>
}

function RateLimitBadge({ status, utilization }: { status: string; utilization: number | null }) {
  const pct = utilization != null ? Math.round(utilization * 100) : null
  const isWarning = status === 'allowed_warning'
  const isRejected = status === 'rejected'

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-main)]">
        <div
          className={`h-full rounded-full transition-all ${
            isRejected ? 'bg-red-400' : isWarning ? 'bg-yellow-400' : 'bg-green-400'
          }`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      {pct != null && (
        <span className={isRejected ? 'text-red-400' : isWarning ? 'text-yellow-400' : ''}>
          {pct}%
        </span>
      )}
    </div>
  )
}
