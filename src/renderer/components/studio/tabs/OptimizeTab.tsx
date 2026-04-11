import { useState } from 'react'
import { useAppStore } from '../../../stores/app-store'
import { cliApi } from '../../../lib/cli-api'

interface OptimizeTabProps {
  type: 'skill' | 'agent'
  name: string
}

export function OptimizeTab({ type, name }: OptimizeTabProps) {
  const { currentSessionId, setStudioBottomTab } = useAppStore()
  const [running, setRunning] = useState(false)

  const handleOptimize = async () => {
    if (!currentSessionId || !name) return
    setRunning(true)
    try {
      const skillName = type === 'skill' ? 'skill-creator' : 'agent-create'
      const message = `Use the /${skillName} skill to optimize the description for the ${type} "${name}". Generate trigger eval queries, run the optimization loop, and show results.`
      await cliApi.sendMessage(currentSessionId, message)
      useAppStore.getState().addMessage({ type: 'user_message', text: `[Studio] Optimize description: ${name}` })
      useAppStore.getState().setIsStreaming(true)
      setStudioBottomTab('cli')
    } catch (e) {
      console.error('[OptimizeTab] error:', e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Description Optimization
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        {type === 'skill' ? 'skill-creator' : 'agent-create'}의 디스크립션 최적화 루프를 실행합니다.
        트리거 eval 쿼리를 생성하고, 반복적으로 디스크립션을 개선하여 트리거 정확도를 높입니다.
      </div>

      {!currentSessionId ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          CLI 세션이 필요합니다. 채팅에서 세션을 시작해주세요.
        </div>
      ) : (
        <button
          onClick={handleOptimize}
          disabled={running || !name}
          style={{
            padding: '6px 14px', fontSize: 11, fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: running ? 'wait' : 'pointer', opacity: running || !name ? 0.5 : 1,
          }}
        >
          {running ? 'Running...' : 'Start Optimization'}
        </button>
      )}
    </div>
  )
}
