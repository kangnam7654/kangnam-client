import { useState, useRef, useEffect } from 'react'
import { useAppStore, type Conversation } from '../../stores/app-store'

export function ConversationList() {
  const { conversations, activeConversationId, setActiveConversationId, setConversations } = useAppStore()
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpenId])

  const handleSelect = (id: string) => {
    if (renamingId === id) return
    setActiveConversationId(id)
  }

  const handleDelete = async (id: string) => {
    setMenuOpenId(null)
    if (!confirm('이 대화를 삭제하시겠습니까?')) return
    await window.api.conv.delete(id)
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)
    if (activeConversationId === id) {
      setActiveConversationId(null)
    }
  }

  const handleTogglePin = async (id: string) => {
    setMenuOpenId(null)
    await window.api.conv.togglePin(id)
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)
  }

  const handleRenameStart = (id: string) => {
    setMenuOpenId(null)
    setRenamingId(id)
  }

  const handleRenameCommit = async (id: string, newTitle: string) => {
    setRenamingId(null)
    const trimmed = newTitle.trim()
    if (!trimmed) return
    await window.api.conv.updateTitle(id, trimmed)
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)
  }

  const handleMenuToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setMenuOpenId(menuOpenId === id ? null : id)
  }

  if (conversations.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)] text-[13px]">
        No conversations yet
      </div>
    )
  }

  const pinned = conversations.filter(c => c.pinned)
  const unpinned = conversations.filter(c => !c.pinned)

  return (
    <div className="flex flex-col">
      {/* Pinned section */}
      {pinned.length > 0 && (
        <>
          <div style={{ padding: '8px 12px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pinned</span>
          </div>
          {pinned.map(conv => (
            <ConvItem
              key={conv.id}
              conv={conv}
              isActive={activeConversationId === conv.id}
              isMenuOpen={menuOpenId === conv.id}
              isRenaming={renamingId === conv.id}
              menuRef={menuRef}
              onSelect={handleSelect}
              onMenuToggle={handleMenuToggle}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onRenameStart={handleRenameStart}
              onRenameCommit={handleRenameCommit}
            />
          ))}
          <div style={{ margin: '4px 0', borderTop: '1px solid var(--border-subtle)' }} />
        </>
      )}

      {/* Unpinned */}
      {unpinned.map(conv => (
        <ConvItem
          key={conv.id}
          conv={conv}
          isActive={activeConversationId === conv.id}
          isMenuOpen={menuOpenId === conv.id}
          isRenaming={renamingId === conv.id}
          menuRef={menuRef}
          onSelect={handleSelect}
          onMenuToggle={handleMenuToggle}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
          onRenameStart={handleRenameStart}
          onRenameCommit={handleRenameCommit}
        />
      ))}
    </div>
  )
}

interface ConvItemProps {
  conv: { id: string; title: string; pinned: number }
  isActive: boolean
  isMenuOpen: boolean
  isRenaming: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onSelect: (id: string) => void
  onMenuToggle: (e: React.MouseEvent, id: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  onRenameStart: (id: string) => void
  onRenameCommit: (id: string, newTitle: string) => void
}

function ConvItem({ conv, isActive, isMenuOpen, isRenaming, menuRef, onSelect, onMenuToggle, onDelete, onTogglePin, onRenameStart, onRenameCommit }: ConvItemProps) {
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [renameValue, setRenameValue] = useState(conv.title)

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(conv.title)
      setTimeout(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      }, 0)
    }
  }, [isRenaming, conv.title])

  const commitRename = () => {
    onRenameCommit(conv.id, renameValue)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 2 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(conv.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(conv.id) } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 12px',
          borderRadius: 8, border: 'none',
          background: isActive ? 'var(--bg-hover)' : 'transparent',
          cursor: 'pointer', fontSize: 14,
          color: 'var(--text-primary)',
          textAlign: 'left',
          transition: 'background 0.15s',
          overflow: 'hidden'
        }}
        className="group"
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {conv.pinned ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <path d="M16 2l5 5-3.5 3.5 2 6L14 11l-5.5 5.5V20H5v-3.5L10.5 11 5 5.5l6 2L14.5 4z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') onRenameCommit(conv.id, conv.title)
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        ) : (
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={conv.title}>{conv.title}</span>
        )}
        {!isRenaming && (
          <button
            onClick={(e) => onMenuToggle(e, conv.id)}
            aria-label="Conversation menu"
            style={{
              padding: 4, border: 'none', background: 'transparent',
              cursor: 'pointer', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'opacity 0.15s, background 0.15s',
              flexShrink: 0,
              opacity: isMenuOpen ? 1 : undefined
            }}
            className={`${isMenuOpen ? '' : 'opacity-0 group-hover:opacity-100'} hover:bg-[var(--bg-hover)]`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            right: 4,
            top: '100%',
            marginTop: 2,
            zIndex: 50,
            minWidth: 200,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 4px 24px var(--shadow-pill)',
            overflow: 'hidden',
            padding: 6
          }}
        >
          <button
            onClick={() => onRenameStart(conv.id)}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>
          <button
            onClick={() => onTogglePin(conv.id)}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v1a1 1 0 001 1 1 1 0 011 1z" />
            </svg>
            {conv.pinned ? 'Unpin' : 'Pin to top'}
          </button>
          <button
            onClick={() => { window.api.conv.export(conv.id, 'markdown') }}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export (.md)
          </button>
          <button
            onClick={() => { window.api.conv.export(conv.id, 'json') }}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export (.json)
          </button>
          <button
            onClick={() => onDelete(conv.id)}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)] transition-colors text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
