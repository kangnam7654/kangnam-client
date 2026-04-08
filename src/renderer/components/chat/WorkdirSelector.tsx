import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

interface WorkdirSelectorProps {
  onSessionStarted: () => void
}

export function WorkdirSelector({ onSessionStarted }: WorkdirSelectorProps) {
  const { currentProvider, setCurrentSessionId, clearMessages, setCurrentWorkingDir } = useAppStore()
  const [recentDirs] = useState<string[]>(() => {
    const stored = localStorage.getItem('recentWorkdirs')
    return stored ? JSON.parse(stored) : []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = async (dir: string) => {
    if (!currentProvider) {
      setError('프로바이더가 선택되지 않았습니다. 설정에서 CLI를 선택해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    clearMessages()

    try {
      // Save to recent dirs
      const updated = [dir, ...recentDirs.filter((d) => d !== dir)].slice(0, 5)
      localStorage.setItem('recentWorkdirs', JSON.stringify(updated))

      const sessionId = await cliApi.startSession(currentProvider, dir)
      setCurrentSessionId(sessionId)
      setCurrentWorkingDir(dir)
      onSessionStarted()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`세션 시작 실패: ${msg}`)
      console.error('[WorkdirSelector] startSession failed:', e)
    } finally {
      setLoading(false)
    }
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

      {error && (
        <div className="w-full max-w-md rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex w-full max-w-md flex-col gap-2">
        {recentDirs.map((dir) => {
          const name = dir.split('/').pop() || dir
          return (
            <button
              key={dir}
              onClick={() => startSession(dir)}
              disabled={loading}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-left hover:border-[var(--text-tertiary)] disabled:opacity-50"
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
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] p-3 text-sm text-[var(--text-tertiary)] hover:border-[var(--text-secondary)] disabled:opacity-50"
        >
          {loading ? '세션 시작 중...' : '+ 다른 폴더 선택...'}
        </button>
      </div>
    </div>
  )
}
