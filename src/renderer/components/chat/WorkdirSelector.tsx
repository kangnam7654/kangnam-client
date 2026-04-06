import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

interface WorkdirSelectorProps {
  onSessionStarted: () => void
}

export function WorkdirSelector({ onSessionStarted }: WorkdirSelectorProps) {
  const { currentProvider, setCurrentSessionId, clearMessages } = useAppStore()
  const [recentDirs] = useState<string[]>(() => {
    const stored = localStorage.getItem('recentWorkdirs')
    return stored ? JSON.parse(stored) : []
  })

  const startSession = async (dir: string) => {
    if (!currentProvider) return
    clearMessages()

    // Save to recent dirs
    const updated = [dir, ...recentDirs.filter((d) => d !== dir)].slice(0, 5)
    localStorage.setItem('recentWorkdirs', JSON.stringify(updated))

    const sessionId = await cliApi.startSession(currentProvider, dir)
    setCurrentSessionId(sessionId)
    onSessionStarted()
  }

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (selected && typeof selected === 'string') {
      await startSession(selected)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 flex-1">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">작업할 폴더를 선택하세요</h2>
      <p className="text-sm text-[var(--text-tertiary)]">AI가 이 폴더 안에서 파일을 읽고 수정합니다</p>

      <div className="flex w-full max-w-md flex-col gap-2">
        {recentDirs.map((dir) => {
          const name = dir.split('/').pop() || dir
          return (
            <button
              key={dir}
              onClick={() => startSession(dir)}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-left hover:border-[var(--text-tertiary)]"
            >
              <span className="text-lg">📁</span>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{name}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{dir}</div>
              </div>
            </button>
          )
        })}

        <button
          onClick={handleBrowse}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] p-3 text-sm text-[var(--text-tertiary)] hover:border-[var(--text-secondary)]"
        >
          + 다른 폴더 선택...
        </button>
      </div>
    </div>
  )
}
