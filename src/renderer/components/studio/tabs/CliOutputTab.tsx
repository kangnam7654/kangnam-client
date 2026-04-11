import { useAppStore } from '../../../stores/app-store'

export function CliOutputTab() {
  const messages = useAppStore((s) => s.messages)

  // Show recent CLI messages relevant to studio operations
  const studioMessages = messages.filter((m) =>
    m.type === 'text_delta' || m.type === 'tool_use_start' || m.type === 'tool_result' || m.type === 'error'
  )

  return (
    <div style={{ padding: 8, fontFamily: 'var(--font-mono, monospace)', fontSize: 11, lineHeight: 1.6 }}>
      {studioMessages.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '12px 8px' }}>
          CLI 출력이 여기에 표시됩니다. 테스트를 실행하면 실시간 로그를 볼 수 있습니다.
        </div>
      ) : (
        studioMessages.slice(-100).map((msg, i) => {
          if (msg.type === 'text_delta') {
            return <span key={i} style={{ color: 'var(--text-primary)' }}>{msg.text}</span>
          }
          if (msg.type === 'tool_use_start') {
            return (
              <div key={i} style={{ color: 'var(--accent)', marginTop: 4 }}>
                {'> '}{msg.name}
              </div>
            )
          }
          if (msg.type === 'tool_result') {
            return (
              <div key={i} style={{ color: msg.is_error ? 'var(--danger)' : '#22c55e', whiteSpace: 'pre-wrap' }}>
                {msg.output.slice(0, 500)}
              </div>
            )
          }
          if (msg.type === 'error') {
            return (
              <div key={i} style={{ color: 'var(--danger)' }}>Error: {msg.message}</div>
            )
          }
          return null
        })
      )}
    </div>
  )
}
