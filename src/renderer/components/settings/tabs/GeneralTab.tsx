import { useState } from 'react'
import { useAppStore } from '../../../stores/app-store'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{children}</h3>
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{children}</p>
}

export function GeneralTab() {
  const { setConversations, setActiveConversationId, conversations, theme, setTheme } = useAppStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDeleteAll = async () => {
    await window.api.conv.deleteAll()
    setConversations([])
    setActiveConversationId(null)
    setConfirmDelete(false)
  }

  return (
    <div>
      <SectionTitle>General</SectionTitle>
      <SectionDesc>Application info and preferences.</SectionDesc>

      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Kangnam Client</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Desktop LLM chat client</p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>v1.0.0</span>
        </div>
      </div>

      {/* Theme */}
      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Theme</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Switch between light and dark mode</p>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--bg-hover)' }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
                  background: theme === t ? 'var(--accent)' : 'transparent',
                  color: theme === t ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data management */}
      <SectionTitle>Data</SectionTitle>
      <SectionDesc>Manage your conversation history.</SectionDesc>

      <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Delete all conversations</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{conversations.length} conversations</p>
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={conversations.length === 0}
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
                background: 'rgba(239,68,68,0.1)', color: conversations.length === 0 ? 'var(--text-muted)' : 'var(--danger)',
                cursor: conversations.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                opacity: conversations.length === 0 ? 0.5 : 1
              }}
              className={conversations.length > 0 ? 'hover:bg-[rgba(239,68,68,0.2)]' : ''}
            >
              Delete all
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
                className="hover:bg-[rgba(255,255,255,0.1)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, background: 'var(--danger)', color: 'white', cursor: 'pointer', transition: 'all 0.15s' }}
                className="hover:opacity-85"
              >
                Confirm delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
