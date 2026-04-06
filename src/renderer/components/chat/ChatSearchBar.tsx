import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../stores/app-store'

interface ChatSearchBarProps {
  onClose: () => void
}

export function ChatSearchBar({ onClose }: ChatSearchBarProps) {
  const { messages } = useAppStore()
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const matchElementsRef = useRef<Element[]>([])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Find and highlight matches when query changes
  useEffect(() => {
    clearHighlights()

    if (!query.trim()) {
      setMatchCount(0)
      setCurrentMatch(0)
      matchElementsRef.current = []
      return
    }

    const q = query.toLowerCase()

    // Count matching text_delta messages for the counter
    const matchingMsgs = messages.filter(
      m => m.type === 'text_delta' && m.text.toLowerCase().includes(q)
    )
    setMatchCount(matchingMsgs.length)
    setCurrentMatch(matchingMsgs.length > 0 ? 0 : -1)

    // Use CSS Highlight API for text highlighting
    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
      try {
        const viewport = document.querySelector('.aui-thread-viewport')
        if (!viewport) return

        const ranges: Range[] = []
        const walker = document.createTreeWalker(viewport, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          const text = node.textContent?.toLowerCase() ?? ''
          let startIdx = 0
          while (startIdx < text.length) {
            const foundIdx = text.indexOf(q, startIdx)
            if (foundIdx === -1) break
            const range = new Range()
            range.setStart(node, foundIdx)
            range.setEnd(node, foundIdx + q.length)
            ranges.push(range)
            startIdx = foundIdx + q.length
          }
        }

        if (ranges.length > 0) {
          const highlight = new Highlight(...ranges)
          CSS.highlights.set('search-highlight', highlight)
        }

        // Collect message-level root elements containing matches for scrolling
        // Each message in assistant-ui viewport is a direct child of the viewport scroll container
        const msgRoots: Element[] = []
        const viewportScroll = viewport.firstElementChild ?? viewport
        const children = viewportScroll.children
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (child.textContent?.toLowerCase().includes(q)) {
            msgRoots.push(child)
          }
        }
        matchElementsRef.current = msgRoots

        // Scroll to first match
        if (msgRoots.length > 0) {
          msgRoots[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } catch {
        // Fallback: no highlighting
      }
    }
  }, [query, messages])

  const clearHighlights = () => {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete('search-highlight')
    }
  }

  const goNext = () => {
    const els = matchElementsRef.current
    if (els.length === 0) return
    const next = (currentMatch + 1) % els.length
    setCurrentMatch(next)
    els[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const goPrev = () => {
    const els = matchElementsRef.current
    if (els.length === 0) return
    const prev = (currentMatch - 1 + els.length) % els.length
    setCurrentMatch(prev)
    els[prev]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearHighlights()
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) goPrev()
      else goNext()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => clearHighlights()
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px',
      background: 'var(--bg-surface)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      minWidth: 340
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in conversation..."
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit'
        }}
        className="placeholder-[var(--text-muted)]"
      />

      {query && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {matchCount > 0 ? `${currentMatch + 1} of ${matchCount}` : 'No matches'}
        </span>
      )}

      <div style={{ display: 'flex', gap: 2 }}>
        <button
          onClick={goPrev}
          disabled={matchCount === 0}
          aria-label="Previous match"
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', cursor: matchCount > 0 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: matchCount > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            opacity: matchCount > 0 ? 1 : 0.4
          }}
          className="hover:bg-[rgba(255,255,255,0.08)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          onClick={goNext}
          disabled={matchCount === 0}
          aria-label="Next match"
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', cursor: matchCount > 0 ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: matchCount > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            opacity: matchCount > 0 ? 1 : 0.4
          }}
          className="hover:bg-[rgba(255,255,255,0.08)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => { clearHighlights(); onClose() }}
        aria-label="Close search"
        style={{
          width: 24, height: 24, borderRadius: 6, border: 'none',
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)'
        }}
        className="hover:bg-[rgba(255,255,255,0.08)]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
