import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

interface SkillInfo {
  name: string
  description: string
  is_directory: boolean
}

interface AgentInfo {
  name: string
  description: string
  model: string | null
  is_directory: boolean
}

export function StudioDashboard() {
  const { openStudio } = useAppStore()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      console.log('[StudioDashboard] loading start')
      // Guard: window.api may not exist outside Tauri
      if (!window.api?.claudeCommands?.list) {
        console.warn('[StudioDashboard] window.api not available')
        setLoading(false)
        return
      }
      try {
        const [s, a] = await Promise.all([
          window.api.claudeCommands.list().catch((e: unknown) => { console.error('[StudioDashboard] list skills error:', e); return [] as SkillInfo[] }),
          window.api.agents.listClaude().catch((e: unknown) => { console.error('[StudioDashboard] list agents error:', e); return [] as AgentInfo[] }),
        ])
        console.log('[StudioDashboard] loaded', s.length, 'skills', a.length, 'agents')
        if (!cancelled) {
          setSkills(s as SkillInfo[])
          setAgents(a as AgentInfo[])
        }
      } catch (e) {
        console.error('[StudioDashboard] load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const totalSkills = skills.length
  const totalAgents = agents.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', padding: '0 20px',
        borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Studio</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <>
            {/* Stats cards */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
              <StatCard label="Skills" count={totalSkills} accent="var(--accent)" onClick={() => {}} />
              <StatCard label="Agents" count={totalAgents} accent="#22c55e" onClick={() => {}} />
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <ActionButton label="New Skill" onClick={() => openStudio('skill')} />
              <ActionButton label="New Agent" onClick={() => openStudio('agent')} />
            </div>

            {/* Recent skills */}
            <Section title={`Skills (${totalSkills})`}>
              {skills.length === 0 ? (
                <EmptyMessage text="No custom skills found" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                  {skills.map((s) => (
                    <ItemCard
                      key={s.name}
                      name={s.name}
                      description={s.description}
                      badge="SKILL"
                      badgeColor="var(--accent)"
                      onClick={() => { console.log('[StudioDashboard] click skill:', s.name); openStudio('skill', s.name) }}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Agents */}
            <Section title={`Agents (${totalAgents})`}>
              {agents.length === 0 ? (
                <EmptyMessage text="No custom agents found" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                  {agents.map((a) => (
                    <ItemCard
                      key={a.name}
                      name={a.name}
                      description={a.description}
                      badge={a.model || 'AGENT'}
                      badgeColor="#22c55e"
                      onClick={() => openStudio('agent', a.name)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, count, accent, onClick }: { label: string; count: number; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, maxWidth: 200, padding: '16px 20px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', cursor: 'pointer',
        textAlign: 'left', transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>{count}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </button>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', fontSize: 12, fontWeight: 600,
        background: 'var(--accent)', color: '#fff',
        border: 'none', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', transition: 'opacity 0.15s',
      }}
    >
      + {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function ItemCard({ name, description, badge, badgeColor, onClick }: {
  name: string; description: string; badge: string; badgeColor: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '10px 14px', textAlign: 'left',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: badgeColor, flexShrink: 0 }}>{badge}</span>
      </div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {description}
        </div>
      )}
    </button>
  )
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>
  )
}
