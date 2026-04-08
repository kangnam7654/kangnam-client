import { useAppStore } from '../../stores/app-store'

export function TaskPanel() {
  const { activeTasks } = useAppStore()

  const visibleTasks = activeTasks.filter(
    (t) => t.status === 'running' || t.status === 'completed' || t.status === 'failed'
  )

  if (visibleTasks.length === 0) return null

  return (
    <div className="border-t border-[var(--border-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-secondary)]">Tasks</span>
        <span className="text-xs text-[var(--text-tertiary)]">{visibleTasks.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {visibleTasks.map((task) => (
          <div
            key={task.task_id}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <TaskStatusIcon status={task.status} />
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {task.description}
                </span>
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 ml-2">
                {task.task_type}
              </span>
            </div>
            {task.summary && (
              <p className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">
                {task.summary}
              </p>
            )}
            {task.status === 'running' && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-main)]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-green-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400 shrink-0" />
    case 'completed':
      return <span className="text-green-400 text-xs shrink-0">&#10003;</span>
    case 'failed':
      return <span className="text-red-400 text-xs shrink-0">&#10007;</span>
    case 'stopped':
      return <span className="text-yellow-400 text-xs shrink-0">&#9632;</span>
    default:
      return <span className="inline-block h-2 w-2 rounded-full bg-[var(--text-muted)] shrink-0" />
  }
}
