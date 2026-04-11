import { useState, useEffect, useRef } from 'react'

interface RefFile {
  filename: string
  size: number
  is_main: boolean
}

interface EditorModalProps {
  title: string
  initial?: { name: string; description: string; instructions: string; model?: string | null; refs?: RefFile[] }
  showModel?: boolean
  /** Skill name for ref file management (enables refs section) */
  skillName?: string
  onSave: (data: { name: string; description: string; instructions: string; model?: string | null }) => void
  onCancel: () => void
}

export function EditorModal({ title, initial, showModel, skillName, onSave, onCancel }: EditorModalProps) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [instructions, setInstructions] = useState(initial?.instructions || '')
  const [model, setModel] = useState(initial?.model || '')
  const [refs, setRefs] = useState<RefFile[]>(initial?.refs || [])
  const [activeRef, setActiveRef] = useState<string | null>(null)
  const [refContent, setRefContent] = useState('')
  const [newRefName, setNewRefName] = useState('')
  const [showNewRef, setShowNewRef] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const isEdit = !!initial?.name

  useEffect(() => {
    if (!isEdit) nameRef.current?.focus()
  }, [isEdit])

  // Load refs for directory-based skills
  useEffect(() => {
    if (skillName && isEdit) {
      window.api?.claudeCommands?.listRefs?.(skillName)
        .then(r => setRefs(r || []))
        .catch(() => {})
    }
  }, [skillName, isEdit])

  const handleSave = () => {
    const trimmedName = name.trim().replace(/\s+/g, '-').toLowerCase()
    if (!trimmedName || !instructions.trim()) return
    onSave({
      name: trimmedName,
      description: description.trim(),
      instructions: instructions.trim(),
      model: showModel && model ? model : undefined,
    })
  }

  const handleOpenRef = async (filename: string) => {
    if (!skillName) return
    try {
      const content = await window.api.claudeCommands.readRef(skillName, filename)
      setRefContent(content)
      setActiveRef(filename)
    } catch { /* ignore */ }
  }

  const handleSaveRef = async () => {
    if (!skillName || !activeRef) return
    try {
      await window.api.claudeCommands.writeRef(skillName, activeRef, refContent)
      const r = await window.api.claudeCommands.listRefs(skillName)
      setRefs(r || [])
    } catch { /* ignore */ }
  }

  const handleAddRef = async () => {
    if (!skillName || !newRefName.trim()) return
    const filename = newRefName.trim().endsWith('.md') ? newRefName.trim() : `${newRefName.trim()}.md`
    try {
      await window.api.claudeCommands.writeRef(skillName, filename, `# ${filename.replace('.md', '')}\n\n`)
      const r = await window.api.claudeCommands.listRefs(skillName)
      setRefs(r || [])
      setShowNewRef(false)
      setNewRefName('')
      handleOpenRef(filename)
    } catch { /* ignore */ }
  }

  const handleDeleteRef = async (filename: string) => {
    if (!skillName) return
    try {
      await window.api.claudeCommands.deleteRef(skillName, filename)
      const r = await window.api.claudeCommands.listRefs(skillName)
      setRefs(r || [])
      if (activeRef === filename) { setActiveRef(null); setRefContent('') }
    } catch { /* ignore */ }
  }

  const nonMainRefs = refs.filter(r => !r.is_main)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          width: '92%', maxWidth: 680, maxHeight: '85vh',
          border: '1px solid var(--border)', boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          {activeRef && (
            <button onClick={() => { setActiveRef(null); setRefContent('') }}
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ← 메인으로 돌아가기
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeRef ? (
            /* ── Ref file editor ── */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{activeRef}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>reference</span>
              </div>
              <textarea
                value={refContent}
                onChange={e => setRefContent(e.target.value)}
                style={{
                  flex: 1, minHeight: 280, padding: '8px 10px',
                  fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.6,
                  background: 'var(--bg-main)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  outline: 'none', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={handleSaveRef} style={btnAccent}>저장</button>
              </div>
            </>
          ) : (
            /* ── Main editor ── */
            <>
              {/* Name */}
              <Field label="Name">
                <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} disabled={isEdit}
                  placeholder="my-skill" style={inputStyle(isEdit)} />
              </Field>

              {/* Description */}
              <Field label="Description">
                <input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder='Use when... (trigger condition)' style={inputStyle(false)} />
              </Field>

              {/* Model (agents only) */}
              {showModel && (
                <Field label="Model (optional)">
                  <select value={model} onChange={e => setModel(e.target.value)} style={inputStyle(false)}>
                    <option value="">Default (inherit)</option>
                    <option value="opus">Opus</option>
                    <option value="sonnet">Sonnet</option>
                    <option value="haiku">Haiku</option>
                  </select>
                </Field>
              )}

              {/* Instructions */}
              <Field label="Instructions" flex>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                  placeholder="Skill/agent instructions in markdown..."
                  style={{
                    flex: 1, minHeight: 180, marginTop: 4, padding: '8px 10px',
                    fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.6,
                    background: 'var(--bg-main)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                    outline: 'none', resize: 'vertical',
                  }}
                />
              </Field>

              {/* References section */}
              {(skillName || !isEdit) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      References ({nonMainRefs.length})
                    </span>
                    {isEdit && (
                      <button onClick={() => setShowNewRef(true)}
                        style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        + 추가
                      </button>
                    )}
                  </div>

                  {!isEdit && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      저장 후 레퍼런스 파일을 추가할 수 있습니다
                    </div>
                  )}

                  {nonMainRefs.map(ref => (
                    <div key={ref.filename} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)', fontSize: 12,
                    }} className="hover:bg-[var(--bg-hover)]">
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>📄</span>
                      <button onClick={() => handleOpenRef(ref.filename)}
                        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                        {ref.filename}
                      </button>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatBytes(ref.size)}</span>
                      <button onClick={() => handleDeleteRef(ref.filename)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 10, padding: '2px 4px' }}>
                        ✕
                      </button>
                    </div>
                  ))}

                  {showNewRef && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input value={newRefName} onChange={e => setNewRefName(e.target.value)}
                        placeholder="filename.md" onKeyDown={e => { if (e.key === 'Enter') handleAddRef() }}
                        style={{ ...inputStyle(false), flex: 1, fontSize: 11, padding: '3px 8px' }} autoFocus />
                      <button onClick={handleAddRef} style={{ ...btnAccent, padding: '3px 8px', fontSize: 10 }}>추가</button>
                      <button onClick={() => { setShowNewRef(false); setNewRefName('') }}
                        style={{ ...btnOutline, padding: '3px 8px', fontSize: 10 }}>취소</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!activeRef && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onCancel} style={btnOutline}>취소</button>
            <button onClick={handleSave}
              disabled={!name.trim() || !instructions.trim()}
              style={{
                ...btnAccent,
                opacity: name.trim() && instructions.trim() ? 1 : 0.4,
                cursor: name.trim() && instructions.trim() ? 'pointer' : 'default',
              }}>
              {isEdit ? '저장' : '생성'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, flex, children }: { label: string; flex?: boolean; children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      ...(flex ? { flex: 1, display: 'flex', flexDirection: 'column' as const } : {}),
    }}>
      {label}
      {children}
    </label>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  return `${(bytes / 1024).toFixed(1)}KB`
}

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', marginTop: 4, padding: '6px 10px',
  fontSize: 13, fontFamily: 'var(--font-mono)',
  background: disabled ? 'var(--bg-hover)' : 'var(--bg-main)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', outline: 'none',
})

const btnAccent: React.CSSProperties = {
  padding: '6px 16px', fontSize: 13, fontWeight: 600,
  borderRadius: 'var(--radius-md)', border: 'none',
  background: 'var(--accent)', color: '#fff', cursor: 'pointer',
}
const btnOutline: React.CSSProperties = {
  padding: '6px 16px', fontSize: 13,
  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
}
