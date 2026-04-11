import { useState, useRef, useEffect } from 'react'
import { useAppStore, type Conversation, type Message } from '../../stores/app-store'

export function ConversationList() {
  const { conversations, activeConversationId, setActiveConversationId, setConversations, currentSessionId } = useAppStore()
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Load conversations on mount and when session changes
  useEffect(() => {
    window.api?.conv?.list?.()
      .then((convs: unknown) => setConversations(convs as Conversation[]))
      .catch(() => {})
  }, [currentSessionId, setConversations])

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

  const handleSelect = async (id: string) => {
    if (selectMode) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      return
    }
    if (renamingId === id) return
    setActiveConversationId(id)
    if (id === currentSessionId) return
    try {
      const dbMessages = await window.api.conv.getMessages(id) as Message[]
      const { clearMessages, addMessage, setIsStreaming } = useAppStore.getState()
      setIsStreaming(false)
      clearMessages()
      for (const msg of dbMessages) {
        if (msg.role === 'user') {
          addMessage({ type: 'user_message', text: msg.content })
        } else if (msg.role === 'assistant') {
          addMessage({ type: 'text_delta', text: msg.content })
        } else if (msg.role === 'tool' && msg.tool_name) {
          addMessage({ type: 'tool_result', id: msg.tool_use_id || '', output: msg.content, is_error: false })
        }
      }
    } catch { /* ignore */ }
  }

  const handleDeleteRequest = (id: string) => {
    setMenuOpenId(null)
    setDeleteConfirmId(id)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    await window.api.conv.delete(id)
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)
    if (activeConversationId === id) setActiveConversationId(null)
  }

  const handleBulkDelete = async () => {
    setBulkDeleteConfirm(false)
    for (const id of selectedIds) {
      await window.api.conv.delete(id)
    }
    const convs = await window.api.conv.list() as Conversation[]
    setConversations(convs)
    if (activeConversationId && selectedIds.has(activeConversationId)) {
      setActiveConversationId(null)
    }
    setSelectedIds(new Set())
    setSelectMode(false)
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

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const selectAll = () => {
    setSelectedIds(new Set(conversations.filter(c => c.id !== currentSessionId).map(c => c.id)))
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
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Selection toolbar */}
      {selectMode ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
          borderBottom: '1px solid var(--border)', fontSize: 11,
        }}>
          <button
            onClick={selectAll}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            전체 선택
          </button>
          <button
            onClick={() => selectedIds.size > 0 && setBulkDeleteConfirm(true)}
            disabled={selectedIds.size === 0}
            style={{
              padding: '3px 8px', fontSize: 11, fontWeight: 600,
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: selectedIds.size > 0 ? 'var(--danger)' : 'var(--bg-hover)',
              color: selectedIds.size > 0 ? '#fff' : 'var(--text-muted)',
              cursor: selectedIds.size > 0 ? 'pointer' : 'default',
            }}
          >
            삭제 ({selectedIds.size})
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={exitSelectMode}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            취소
          </button>
        </div>
      ) : (
        conversations.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px' }}>
            <button
              onClick={() => setSelectMode(true)}
              title="여러 대화 선택"
              style={{
                padding: '2px 6px', fontSize: 10, borderRadius: 'var(--radius-sm)',
                border: 'none', background: 'transparent',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
              className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
            >
              선택
            </button>
          </div>
        )
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
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
                isCurrent={currentSessionId === conv.id}
                isMenuOpen={menuOpenId === conv.id}
                isRenaming={renamingId === conv.id}
                selectMode={selectMode}
                isSelected={selectedIds.has(conv.id)}
                menuRef={menuRef}
                onSelect={handleSelect}
                onMenuToggle={handleMenuToggle}
                onDelete={handleDeleteRequest}
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
            isCurrent={currentSessionId === conv.id}
            isMenuOpen={menuOpenId === conv.id}
            isRenaming={renamingId === conv.id}
            selectMode={selectMode}
            isSelected={selectedIds.has(conv.id)}
            menuRef={menuRef}
            onSelect={handleSelect}
            onMenuToggle={handleMenuToggle}
            onDelete={handleDeleteRequest}
            onTogglePin={handleTogglePin}
            onRenameStart={handleRenameStart}
            onRenameCommit={handleRenameCommit}
          />
        ))}
      </div>

      {/* Single delete confirmation */}
      {deleteConfirmId && (
        <ConfirmDialog
          title="대화 삭제"
          message="이 대화를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirm && (
        <ConfirmDialog
          title="대화 일괄 삭제"
          message={`선택한 ${selectedIds.size}개의 대화를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}
    </div>
  )
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          padding: 24, maxWidth: 320, width: '90%',
          border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px', fontSize: 13, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 16px', fontSize: 13, fontWeight: 600,
              borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--danger)', color: '#fff', cursor: 'pointer',
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConvItemProps {
  conv: { id: string; title: string; pinned: number }
  isActive: boolean
  isCurrent: boolean
  isMenuOpen: boolean
  isRenaming: boolean
  selectMode: boolean
  isSelected: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onSelect: (id: string) => void
  onMenuToggle: (e: React.MouseEvent, id: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  onRenameStart: (id: string) => void
  onRenameCommit: (id: string, newTitle: string) => void
}

function ConvItem({ conv, isActive, isCurrent, isMenuOpen, isRenaming, selectMode, isSelected, menuRef, onSelect, onMenuToggle, onDelete, onTogglePin, onRenameStart, onRenameCommit }: ConvItemProps) {
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
          display: 'flex', alignItems: 'center', gap: selectMode ? 8 : 10,
          width: '100%', padding: selectMode ? '8px 10px' : '10px 12px',
          borderRadius: 8, border: 'none',
          background: isSelected ? 'rgba(99,102,241,0.1)' : isActive ? 'var(--bg-hover)' : 'transparent',
          cursor: 'pointer', fontSize: 14,
          color: 'var(--text-primary)',
          textAlign: 'left',
          transition: 'background 0.15s',
          overflow: 'hidden'
        }}
        className="group"
        onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'transparent' }}
      >
        {selectMode ? (
          <span style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: isSelected ? 'none' : '1.5px solid var(--text-muted)',
            background: isSelected ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
        ) : conv.pinned ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <path d="M16 2l5 5-3.5 3.5 2 6L14 11l-5.5 5.5V20H5v-3.5L10.5 11 5 5.5l6 2L14.5 4z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: isCurrent ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}>
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
              flex: 1, minWidth: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent)',
              borderRadius: 6, padding: '2px 6px',
              fontSize: 13, color: 'var(--text-primary)', outline: 'none'
            }}
          />
        ) : (
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={conv.title}>{conv.title}</span>
        )}
        {!isRenaming && !selectMode && (
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
      {isMenuOpen && !selectMode && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute', right: 4, top: '100%', marginTop: 2,
            zIndex: 50, minWidth: 200,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: '0 4px 24px var(--shadow-pill)',
            overflow: 'hidden', padding: 6
          }}
        >
          <button onClick={() => onRenameStart(conv.id)}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>
          <button onClick={() => onTogglePin(conv.id)}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v1a1 1 0 001 1 1 1 0 011 1z" />
            </svg>
            {conv.pinned ? 'Unpin' : 'Pin to top'}
          </button>
          <button onClick={() => { window.api.conv.export(conv.id, 'markdown') }}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export (.md)
          </button>
          <button onClick={() => { window.api.conv.export(conv.id, 'json') }}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export (.json)
          </button>
          <button onClick={() => onDelete(conv.id)}
            className="flex items-center gap-3 w-full px-3.5 py-3 rounded-lg text-[13.5px] text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)] transition-colors text-left">
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
