import type { CliStatus } from '../../stores/app-store'
import type { ProviderMeta } from '../../lib/cli-api'

interface CliCardProps {
  meta: ProviderMeta
  status: CliStatus | null
  selected: boolean
  onToggle: () => void
  onInstall: () => void
  installing: boolean
}

export function CliCard({ meta, status, selected, onToggle, onInstall, installing }: CliCardProps) {
  const installed = status?.installed ?? false

  return (
    <button
      onClick={installed ? onToggle : onInstall}
      disabled={installing}
      className={`flex-1 rounded-xl border-2 p-5 text-center transition-colors ${
        selected
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
      } ${installing ? 'opacity-50' : 'hover:border-[var(--text-tertiary)]'}`}
    >
      <div className="mb-2 text-lg font-bold text-[var(--text-primary)]">{meta.display_name}</div>
      <div className="mb-3 text-xs text-[var(--text-tertiary)]">{meta.description}</div>

      {installed ? (
        <>
          <div className="mb-2 text-xs text-green-400">v{status?.version ?? '?'} 설치됨</div>
          {selected && (
            <span className="inline-block rounded-md bg-green-400 px-3 py-1 text-xs font-bold text-[var(--bg-main)]">
              선택됨
            </span>
          )}
        </>
      ) : installing ? (
        <div className="text-xs text-yellow-400">설치 중...</div>
      ) : (
        <span className="inline-block rounded-md bg-[var(--bg-main)] px-3 py-1 text-xs text-[var(--text-primary)]">
          설치하기
        </span>
      )}
    </button>
  )
}
