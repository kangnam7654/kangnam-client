import { useState, useMemo } from 'react'

interface CommandPaletteProps {
  query: string
  skills: Array<{ name: string; description: string }>
  onSelect: (skillName: string) => void
  onClose: () => void
}

export function CommandPalette({ query, skills, onSelect, onClose }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().replace(/^\//, '')
    if (!q) return skills
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    )
  }, [query, skills])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      onSelect(filtered[selectedIndex].name)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (filtered.length === 0) return null

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2 shadow-xl"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-1 px-2 text-xs text-[var(--text-tertiary)]">Skills</div>
      {filtered.map((skill, i) => (
        <button
          key={skill.name}
          onClick={() => onSelect(skill.name)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
            i === selectedIndex ? 'bg-[var(--accent)]/15' : ''
          }`}
        >
          <span className="font-mono text-sm font-bold text-[var(--accent)]">/{skill.name}</span>
          <span className="text-xs text-[var(--text-tertiary)]">— {skill.description}</span>
        </button>
      ))}
    </div>
  )
}
