import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

export function SkillBrowser() {
  const { sessionMeta, currentSessionId } = useAppStore()

  if (!sessionMeta || !currentSessionId) return null

  const skills = sessionMeta.skills ?? []
  const slashCommands = sessionMeta.slash_commands ?? []

  const builtinCommands = slashCommands.filter((c) =>
    ['/compact', '/clear', '/help', '/cost'].includes(c)
  )
  const customCommands = slashCommands.filter(
    (c) => !['/compact', '/clear', '/help', '/cost'].includes(c)
  )
  const allItems = [...skills.map((s) => `/${s}`), ...customCommands]

  if (allItems.length === 0 && builtinCommands.length === 0) return null

  const handleInvoke = async (command: string) => {
    if (!currentSessionId) return
    if (command === '/clear') {
      useAppStore.getState().clearMessages()
    }
    try {
      await cliApi.sendMessage(currentSessionId, command)
    } catch {
      // ignore — error will appear in chat
    }
  }

  return (
    <div className="border-t border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-secondary)]">Skills</span>
        <span className="text-xs text-[var(--text-tertiary)]">{allItems.length}</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {allItems.map((item) => (
          <button
            key={item}
            onClick={() => handleInvoke(item)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span className="text-[var(--text-muted)]">/</span>
            <span className="truncate">{item.replace(/^\//, '')}</span>
          </button>
        ))}
      </div>

      {builtinCommands.length > 0 && (
        <>
          <div className="mt-3 mb-1.5">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">System</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {builtinCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleInvoke(cmd)}
                className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
