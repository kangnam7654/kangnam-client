import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/app-store'
import { cliApi } from '../../lib/cli-api'

const BUILTIN = new Set(['compact', 'clear', 'cost', 'help', 'init', 'review', 'context', 'security-review', 'extra-usage', 'insights'])

interface CustomCommand {
  name: string
  description: string
}

export function SkillBrowser() {
  const { sessionMeta, currentSessionId } = useAppStore()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Load custom commands from ~/.claude/commands/
  const loadCustomCommands = useCallback(async () => {
    try {
      const cmds = await window.api.claudeCommands.list()
      setCustomCommands(cmds)
    } catch { setCustomCommands([]) }
  }, [])

  useEffect(() => { loadCustomCommands() }, [loadCustomCommands])

  const customNames = new Set(customCommands.map(c => c.name))

  // Normalize slash commands — strip leading '/' if present
  const rawCommands = sessionMeta?.slash_commands ?? []
  const slashCommands = rawCommands.map(c => c.startsWith('/') ? c.slice(1) : c)

  console.log('[SkillBrowser] sessionMeta:', !!sessionMeta, 'slash_commands:', slashCommands.length, 'custom:', customCommands.length)

  const builtins = slashCommands.filter(c => BUILTIN.has(c))
  // Plugin skills have "pluginName:skillName" format (contains ':')
  const pluginSkills = slashCommands.filter(c => !BUILTIN.has(c) && c.includes(':'))
  // Non-plugin, non-builtin = custom or user-defined commands
  const otherSkills = slashCommands.filter(c => !BUILTIN.has(c) && !c.includes(':') && !customNames.has(c))

  // Merge file-based custom + session-detected custom (non-plugin, non-builtin)
  const allCustom = [
    ...customCommands.map(c => ({ name: c.name, description: c.description, fromFile: true })),
    ...otherSkills.filter(n => !customNames.has(n)).map(n => ({ name: n, description: '', fromFile: false })),
  ]

  const filteredCustom = (search
    ? allCustom.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : allCustom
  ).sort((a, b) => a.name.localeCompare(b.name))

  const filteredPlugin = (search
    ? pluginSkills.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : pluginSkills
  ).sort((a, b) => a.localeCompare(b))

  const handleInvoke = async (command: string) => {
    if (!currentSessionId) return
    if (command === 'clear') {
      useAppStore.getState().clearMessages()
    }
    const message = BUILTIN.has(command)
      ? `/${command}`
      : `Invoke the /${command} skill using the Skill tool.`
    try {
      await cliApi.sendMessage(currentSessionId, message)
      useAppStore.getState().addMessage({ type: 'user_message', text: `/${command}` })
      useAppStore.getState().setIsStreaming(true)
    } catch { /* error will appear in chat */ }
  }

  const [forkConfirm, setForkConfirm] = useState<string | null>(null)

  const handleEdit = (name: string) => {
    useAppStore.getState().openStudio('skill', name)
  }

  const handleNew = () => {
    useAppStore.getState().openStudio('skill')
  }

  const handlePluginEdit = (qualifiedName: string) => {
    setForkConfirm(qualifiedName)
  }

  const handleForkConfirm = async () => {
    if (!forkConfirm) return
    const [pluginName, skillName] = forkConfirm.includes(':') ? forkConfirm.split(':') : ['', forkConfirm]
    const plugin = sessionMeta?.plugins?.find(p => p.name === pluginName)
    if (plugin) {
      try {
        await window.api.claudeCommands.forkPlugin(plugin.path, skillName)
        await loadCustomCommands()
      } catch { /* ignore */ }
    }
    setForkConfirm(null)
    useAppStore.getState().openStudio('skill', skillName)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await window.api.claudeCommands.delete(deleteConfirm)
      await loadCustomCommands()
      setDeleteConfirm(null)
      if (expanded === deleteConfirm) setExpanded(null)
    } catch { /* ignore */ }
  }

  if (!sessionMeta && !currentSessionId && customCommands.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
        세션이 시작되면 Skills 목록이 표시됩니다
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header: Search + New */}
      <div style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, overflow: 'hidden' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            flex: 1, minWidth: 0, padding: '4px 8px', fontSize: 11,
            background: 'var(--bg-main)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          onClick={() => handleNew()}
          title="새 스킬 만들기"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, flexShrink: 0,
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Builtin */}
        {builtins.length > 0 && (
          <>
            <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Built-in ({builtins.length})
            </div>
            {builtins.map(cmd => (
              <SkillItem
                key={cmd}
                name={cmd}
                icon="⌘"
                iconColor="var(--text-muted)"
                isExpanded={expanded === cmd}
                onToggle={() => setExpanded(expanded === cmd ? null : cmd)}
                onInvoke={() => handleInvoke(cmd)}
                description={getBuiltinDesc(cmd)}
                isCustom={false}
              />
            ))}
          </>
        )}

        {/* Custom skills */}
        <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: builtins.length > 0 ? '1px solid var(--border)' : 'none', marginTop: builtins.length > 0 ? 4 : 0 }}>
          Custom ({filteredCustom.length})
        </div>
        {filteredCustom.length === 0 ? (
          <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
            커스텀 스킬이 없습니다.
            <button
              onClick={() => handleNew()}
              style={{ display: 'block', marginTop: 6, padding: '4px 10px', fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              + 새 스킬 만들기
            </button>
          </div>
        ) : (
          filteredCustom.map(({ name, description, fromFile }) => (
            <SkillItem
              key={name}
              name={name}
              icon="◆"
              iconColor="var(--accent)"
              isExpanded={expanded === name}
              onToggle={() => setExpanded(expanded === name ? null : name)}
              onInvoke={() => handleInvoke(name)}
              description={description || `/${name}`}
              isCustom={fromFile}
              onEdit={() => handleEdit(name)}
              onDelete={fromFile ? () => setDeleteConfirm(name) : undefined}
            />
          ))
        )}

        {/* Plugin skills */}
        {filteredPlugin.length > 0 && (
          <>
            <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
              Plugin ({filteredPlugin.length})
            </div>
            {filteredPlugin.map(name => (
              <SkillItem
                key={name}
                name={name}
                icon="⚡"
                iconColor="var(--warning)"
                isExpanded={expanded === name}
                onToggle={() => setExpanded(expanded === name ? null : name)}
                onInvoke={() => handleInvoke(name)}
                description={name.includes(':') ? `${name.split(':')[0]} 플러그인` : `/${name}`}
                isCustom={false}
                onEdit={() => handlePluginEdit(name)}
              />
            ))}
          </>
        )}
      </div>

      {/* Editor removed — Studio opens in main area */}

      {/* Fork confirmation for plugin skills */}
      {forkConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setForkConfirm(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: 24, maxWidth: 360, width: '90%',
            border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>플러그인 스킬 포크</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <strong>{forkConfirm}</strong> 스킬을 커스텀으로 복사하여 편집하시겠습니까?
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
              ~/.claude/commands/에 복사본이 생성됩니다. 원본 플러그인은 변경되지 않습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setForkConfirm(null)} style={btnOutline}>취소</button>
              <button onClick={handleForkConfirm} style={btnAccent}>포크 & 편집</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            padding: 24, maxWidth: 320, width: '90%',
            border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>스킬 삭제</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              <strong>/{deleteConfirm}</strong> 스킬을 삭제하시겠습니까?<br />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>~/.claude/commands/{deleteConfirm}.md 파일이 삭제됩니다.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={btnOutline}>취소</button>
              <button onClick={handleDelete} style={{ ...btnDanger, fontWeight: 600 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillItem({ name, icon, iconColor, isExpanded, onToggle, onInvoke, description, isCustom, onEdit, onDelete }: {
  name: string; icon: string; iconColor: string
  isExpanded: boolean; onToggle: () => void; onInvoke: () => void
  description: string; isCustom: boolean
  onEdit?: () => void; onDelete?: () => void
}) {
  return (
    <div style={{ margin: '0 4px' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 8px', borderRadius: 'var(--radius-sm)',
          border: 'none', background: isExpanded ? 'var(--bg-hover)' : 'transparent',
          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          textAlign: 'left', transition: 'background 0.15s',
        }}
        className="hover:bg-[var(--bg-hover)]"
      >
        <span style={{ color: iconColor, fontSize: 10 }}>{icon}</span>
        <span style={{ flex: 1 }}>/{name}</span>
        {isCustom && <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>CUSTOM</span>}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, opacity: 0.4 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isExpanded && (
        <div style={{ padding: '4px 8px 8px 28px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <div style={{ marginBottom: 8 }}>{description}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onInvoke} style={btnAccent}>실행</button>
            {onEdit && <button onClick={onEdit} style={btnOutline}>편집</button>}
            {onDelete && <button onClick={onDelete} style={btnDanger}>삭제</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function getBuiltinDesc(cmd: string): string {
  switch (cmd) {
    case 'compact': return '대화 컨텍스트를 압축합니다'
    case 'clear': return '대화를 초기화합니다'
    case 'cost': return '현재 세션 비용을 확인합니다'
    case 'help': return '도움말을 표시합니다'
    case 'init': return '프로젝트 CLAUDE.md를 생성합니다'
    case 'review': return '코드 리뷰를 요청합니다'
    case 'context': return '컨텍스트 사용량을 표시합니다'
    case 'security-review': return '보안 리뷰를 수행합니다'
    case 'extra-usage': return '추가 사용량 정보를 표시합니다'
    case 'insights': return '대화 인사이트를 표시합니다'
    default: return `/${cmd} 실행`
  }
}

const btnAccent: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11, fontWeight: 600,
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
}
const btnOutline: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11,
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
  padding: '4px 12px', fontSize: 11,
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
}
