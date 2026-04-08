import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

export function SafetyDialog() {
  const { pendingPermission, setPendingPermission } = useAppStore()

  if (!pendingPermission || pendingPermission.type !== 'permission_request') return null

  const { id, tool, description, diff } = pendingPermission
  const isDangerous = tool === 'Bash' || tool === 'command'

  const handleResponse = async (allowed: boolean) => {
    await cliApi.permissionResponse(id, allowed)
    setPendingPermission(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xl">{isDangerous ? '⚠️' : '⚠️'}</span>
          <h3 className={`text-base font-bold ${isDangerous ? 'text-red-400' : 'text-yellow-400'}`}>
            {isDangerous ? '명령 실행 요청' : '파일 수정 요청'}
          </h3>
        </div>

        <p className="mb-4 text-sm text-[var(--text-primary)]">{description}</p>

        {diff && (
          <pre className="mb-4 max-h-48 overflow-auto rounded-lg bg-[var(--bg-main)] p-3 font-mono text-xs leading-relaxed">
            {diff.split('\n').map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('+') ? 'text-green-400' :
                  line.startsWith('-') ? 'text-red-400' :
                  'text-[var(--text-tertiary)]'
                }
              >
                {line}
              </div>
            ))}
          </pre>
        )}

        {isDangerous && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
            이 명령은 시스템에 변경을 가합니다.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => handleResponse(false)}
            className="rounded-lg bg-[var(--bg-main)] px-5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            거부
          </button>
          <button
            onClick={() => handleResponse(true)}
            className={`rounded-lg px-5 py-2 text-sm font-bold text-[var(--bg-main)] ${
              isDangerous ? 'bg-yellow-400 hover:bg-yellow-300' : 'bg-green-400 hover:bg-green-300'
            }`}
          >
            허용
          </button>
        </div>
      </div>
    </div>
  )
}
