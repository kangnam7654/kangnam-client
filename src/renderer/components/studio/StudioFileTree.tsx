interface FileInfo {
  filename: string
  size: number
  is_main: boolean
}

interface StudioFileTreeProps {
  type: 'skill' | 'agent'
  name: string
  files: FileInfo[]
  activeFile: string | null
  onSelect: (filename: string | null) => void
  onAddFile: () => void
  onDeleteFile: (filename: string) => void
}

export function StudioFileTree({ type, name, files, activeFile, onSelect, onAddFile, onDeleteFile }: StudioFileTreeProps) {
  const mainFile = type === 'skill' ? 'SKILL.md' : `${name}.md`
  const refFiles = files.filter((f) => !f.is_main)

  return (
    <div style={{
      width: 200, minWidth: 200, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px', fontSize: 10, fontWeight: 600,
        color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.5px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Explorer</span>
        <button
          onClick={onAddFile}
          title="Add file"
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', padding: 2,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Main file */}
        <TreeItem
          filename={mainFile}
          active={activeFile === null}
          onClick={() => onSelect(null)}
          icon={fileIcon(mainFile)}
        />

        {/* Refs folder */}
        {refFiles.length > 0 && (
          <>
            <div style={{
              padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span>{type === 'skill' ? 'refs' : 'refs/'}</span>
            </div>
            {refFiles.map((f) => (
              <TreeItem
                key={f.filename}
                filename={f.filename}
                active={activeFile === f.filename}
                onClick={() => onSelect(f.filename)}
                onDelete={() => onDeleteFile(f.filename)}
                icon={fileIcon(f.filename)}
                indent
                size={f.size}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function TreeItem({ filename, active, onClick, onDelete, icon, indent, size }: {
  filename: string; active: boolean; onClick: () => void
  onDelete?: () => void; icon: string; indent?: boolean; size?: number
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `3px 10px 3px ${indent ? 28 : 10}px`,
        fontSize: 12, cursor: 'pointer',
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 10, opacity: 0.7 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {filename}
      </span>
      {size !== undefined && (
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
          {formatBytes(size)}
        </span>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: 2, display: 'flex', opacity: 0.5,
          }}
          title="Delete"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md': return '\u{1F4C4}'
    case 'py': return '\u{1F40D}'
    case 'sh': return '\u{1F4BB}'
    case 'json': return '\u{1F4CB}'
    case 'yaml': case 'yml': return '\u{2699}'
    default: return '\u{1F4C4}'
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
