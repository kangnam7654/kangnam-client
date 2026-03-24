import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/app-store'

interface SearchResult {
  messageId: string
  conversationId: string
  conversationTitle: string
  content: string
  role: 'user' | 'assistant'
  createdAt: number
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(255,180,50,0.4)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function getSnippet(content: string, query: string, maxLen = 140): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, maxLen)
  const start = Math.max(0, idx - 50)
  const end = Math.min(content.length, idx + query.length + 90)
  let snippet = content.slice(start, end).replace(/\n/g, ' ')
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet += '...'
  return snippet
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString()
}

export function SearchOverlay() {
  const { showSearch, setShowSearch, setActiveConversationId } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (showSearch) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showSearch])

  // Cmd+K shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(!useAppStore.getState().showSearch)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setShowSearch])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await window.api.conv.search(q.trim()) as SearchResult[]
      setResults(res)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 200)
  }

  const handleResultClick = (result: SearchResult) => {
    setActiveConversationId(result.conversationId)
    setShowSearch(false)
  }

  const handleClose = () => {
    setShowSearch(false)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      handleClose()
    }
  }

  if (!showSearch) return null

  // Group results by conversation
  const grouped = results.reduce<Record<string, { title: string; items: SearchResult[] }>>((acc, r) => {
    if (!acc[r.conversationId]) {
      acc[r.conversationId] = { title: r.conversationTitle, items: [] }
    }
    acc[r.conversationId].items.push(r)
    return acc
  }, {})

  const hasResults = Object.keys(grouped).length > 0

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 580,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        background: 'var(--bg-surface)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 16px 70px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        maxHeight: '60vh'
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: (query || hasResults) ? '1px solid rgba(255,255,255,0.08)' : 'none'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') handleClose() }}
            placeholder="Search conversations..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--text-primary)', fontFamily: 'inherit',
              fontWeight: 400
            }}
            className="placeholder-[var(--text-muted)]"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]) }}
              aria-label="Close search"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <kbd style={{
            fontSize: 11, color: 'var(--text-muted)',
            padding: '2px 6px', borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            fontFamily: 'inherit', lineHeight: 1
          }}>ESC</kbd>
        </div>

        {/* Results */}
        {query && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(60vh - 56px)' }}>
            {loading && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} aria-hidden="true">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round" />
                </svg>
                <div style={{ fontSize: 13 }}>Searching...</div>
              </div>
            )}

            {!loading && results.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                No results for "{query}"
              </div>
            )}

            {!loading && Object.entries(grouped).map(([convId, group]) => (
              <div key={convId}>
                {/* Conversation title header */}
                <div style={{
                  padding: '10px 18px 4px',
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {group.title}
                </div>
                {group.items.map(item => (
                  <button
                    key={item.messageId}
                    onClick={() => handleResultClick(item)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      width: '100%', textAlign: 'left',
                      padding: '10px 18px', border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                    className="hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    {/* Role icon */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: item.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1
                    }}>
                      {item.role === 'user' ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        </svg>
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                      }}>
                        {highlightMatch(getSnippet(item.content, query), query)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {timeAgo(item.createdAt)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}

            {/* Bottom padding */}
            {hasResults && <div style={{ height: 8 }} />}
          </div>
        )}
      </div>
    </div>
  )
}
