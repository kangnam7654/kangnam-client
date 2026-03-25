import { useAppStore, type AuthStatus } from '../../../stores/app-store'
import { ALL_PROVIDERS } from '../../../lib/providers'

interface ProvidersTabProps {
  authStatuses: Array<AuthStatus>
  connecting: string | null
  connectError: string | null
  copilotCode: { userCode: string; verificationUri: string } | null
  claudeSetupToken: string
  onConnect: (provider: string, options?: { setupToken?: string }) => void
  onClaudeSetupTokenChange: (value: string) => void
  onCancel: () => void
  onDisconnect: (provider: string) => void
}

export function ProvidersTab({
  authStatuses,
  connecting,
  connectError,
  copilotCode,
  claudeSetupToken,
  onConnect,
  onClaudeSetupTokenChange,
  onCancel,
  onDisconnect,
}: ProvidersTabProps) {
  const devMode = useAppStore(s => s.devMode)

  return (
    <div>
      <SectionTitle>LLM Providers</SectionTitle>
      <SectionDesc>Connect your providers via OAuth or native auth to start chatting.</SectionDesc>

      {connectError && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
          {connectError}
        </div>
      )}

      {copilotCode && (
        <div style={{ padding: 20, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--accent)', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Enter this code on GitHub:</p>
          <div style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', padding: '12px 0', letterSpacing: '0.15em', color: 'var(--accent)' }}>
            {copilotCode.userCode}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            A browser window should have opened. If not, visit github.com/login/device
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {authStatuses.map(status => {
          const info = ALL_PROVIDERS.find(p => p.name === status.provider)
          if (!info) return null
          if (info.devOnly && !devMode) return null
          const isConnecting = connecting === status.provider
          const isClaude = status.provider === 'claude'
          return (
            <div key={status.provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.connected ? 'var(--success)' : info.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{info.label}</span>
                  {status.connected && (
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)' }}>Connected</span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginLeft: 18, marginTop: 3 }}>{info.description}</p>
                {isClaude && !status.connected && (
                  <div style={{ marginLeft: 18, marginTop: 12 }}>
                    <input
                      type="password"
                      value={claudeSetupToken}
                      onChange={(event) => onClaudeSetupTokenChange(event.target.value)}
                      placeholder="Leave empty to auto-detect from Claude Code"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        maxWidth: 360,
                        padding: '10px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        fontSize: 12.5
                      }}
                    />
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 7 }}>
                      Auto-detects from Claude Code keychain, or paste <code>setup-token</code> / API key
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (isConnecting) { onCancel() }
                  else if (status.connected) { onDisconnect(status.provider) }
                  else if (isClaude) { onConnect(status.provider, { setupToken: claudeSetupToken }) }
                  else { onConnect(status.provider) }
                }}
                style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                  ...(isConnecting
                    ? { background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }
                    : status.connected
                      ? { background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }
                      : { background: 'var(--accent)', color: 'white' }
                  )
                }}
                className={isConnecting ? 'hover:bg-[rgba(239,68,68,0.2)]' : status.connected ? 'hover:bg-[rgba(239,68,68,0.2)]' : 'hover:opacity-85'}
              >
                {isConnecting ? 'Cancel' : status.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{children}</h3>
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{children}</p>
}
