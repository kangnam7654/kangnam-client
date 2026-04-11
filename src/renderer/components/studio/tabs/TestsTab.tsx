import { useState } from 'react'
import { useAppStore } from '../../../stores/app-store'
import { cliApi } from '../../../lib/cli-api'

interface TestsTabProps {
  type: 'skill' | 'agent'
  name: string
}

export function TestsTab({ type, name }: TestsTabProps) {
  const { currentSessionId, setStudioBottomTab } = useAppStore()
  const [running, setRunning] = useState(false)

  const handleRunTests = async () => {
    if (!currentSessionId || !name) return
    setRunning(true)
    try {
      const skillName = type === 'skill' ? 'skill-creator' : 'agent-create'
      const message = `Use the /${skillName} skill to run test cases for the ${type} "${name}". Create 2-3 test prompts if none exist, then run them and show results.`
      await cliApi.sendMessage(currentSessionId, message)
      useAppStore.getState().addMessage({ type: 'user_message', text: `[Studio] Run tests: ${name}` })
      useAppStore.getState().setIsStreaming(true)
      setStudioBottomTab('cli')
    } catch (e) {
      console.error('[TestsTab] error:', e)
    } finally {
      setRunning(false)
    }
  }

  const handleGenerateEvals = async () => {
    if (!currentSessionId || !name) return
    setRunning(true)
    try {
      const skillName = type === 'skill' ? 'skill-creator' : 'agent-create'
      const message = `Use the /${skillName} skill to generate test cases (evals) for the ${type} "${name}". Save them and show me the test prompts for review.`
      await cliApi.sendMessage(currentSessionId, message)
      useAppStore.getState().addMessage({ type: 'user_message', text: `[Studio] Generate evals: ${name}` })
      useAppStore.getState().setIsStreaming(true)
      setStudioBottomTab('cli')
    } catch (e) {
      console.error('[TestsTab] error:', e)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        Test Cases
      </div>

      {!currentSessionId ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          CLI 세션이 필요합니다. 채팅에서 세션을 시작해주세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            CLI를 통해 {type === 'skill' ? 'skill-creator' : 'agent-create'} 워크플로우를 실행합니다.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleGenerateEvals}
              disabled={running}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600,
                background: 'var(--bg-main)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                cursor: running ? 'wait' : 'pointer', opacity: running ? 0.5 : 1,
              }}
            >
              Generate Evals
            </button>
            <button
              onClick={handleRunTests}
              disabled={running}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600,
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: running ? 'wait' : 'pointer', opacity: running ? 0.5 : 1,
              }}
            >
              {running ? 'Running...' : 'Run Tests'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
