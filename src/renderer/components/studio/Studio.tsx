import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'

interface RefFile { filename: string; size: number; is_main: boolean }

export function Studio() {
  const { studioState, closeStudio } = useAppStore()
  if (!studioState) return null
  const key = `${studioState.type}-${studioState.name || 'new'}`
  return studioState.type === 'skill'
    ? <SkillStudio key={key} name={studioState.name} onClose={closeStudio} />
    : <AgentStudio key={key} name={studioState.name} onClose={closeStudio} />
}

// ── Skill Studio ──

function SkillStudio({ name: initialName, onClose }: { name?: string; onClose: () => void }) {
  const isNew = !initialName
  const [name, setName] = useState(initialName || '')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [refs, setRefs] = useState<RefFile[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [newRefName, setNewRefName] = useState('')
  const [showNewRef, setShowNewRef] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) { nameRef.current?.focus(); return }
    window.api?.claudeCommands?.read?.(initialName!)
      .then(data => {
        if (data) {
          setName(data.name)
          setDescription(data.description)
          setInstructions(data.instructions)
          setRefs(data.refs || [])
        }
      })
      .catch(() => {})
  }, [initialName, isNew])

  const loadRefs = async () => {
    if (!initialName) return
    try {
      const r = await window.api.claudeCommands.listRefs(initialName)
      setRefs(r || [])
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    // For existing skills, always use initialName as the file identifier
    const fileId = isNew ? name.trim().replace(/\s+/g, '-').toLowerCase() : initialName!
    if (!fileId || !instructions.trim()) return
    try {
      await window.api.claudeCommands.write(fileId, description.trim(), instructions.trim())
      setDirty(false)
      if (isNew) {
        useAppStore.getState().openStudio('skill', fileId)
      }
    } catch { /* ignore */ }
  }

  const openRef = async (filename: string) => {
    if (!initialName) return
    if (activeFile && dirty) return // unsaved changes — user must save or discard first
    try {
      const content = await window.api.claudeCommands.readRef(initialName, filename)
      setActiveFile(filename)
      setActiveContent(content)
      setDirty(false)
    } catch { /* ignore */ }
  }

  const saveRef = async () => {
    if (!initialName || !activeFile) return
    try {
      await window.api.claudeCommands.writeRef(initialName, activeFile, activeContent)
      setDirty(false)
      await loadRefs()
    } catch { /* ignore */ }
  }

  const addRef = async () => {
    if (!initialName || !newRefName.trim()) return
    const fn = newRefName.trim().endsWith('.md') ? newRefName.trim() : `${newRefName.trim()}.md`
    try {
      await window.api.claudeCommands.writeRef(initialName, fn, `# ${fn.replace('.md', '')}\n\n`)
      await loadRefs()
      setShowNewRef(false)
      setNewRefName('')
      openRef(fn)
    } catch { /* ignore */ }
  }

  const deleteRef = async (fn: string) => {
    if (!initialName) return
    try {
      await window.api.claudeCommands.deleteRef(initialName, fn)
      await loadRefs()
      if (activeFile === fn) { setActiveFile(null); setActiveContent('') }
    } catch { /* ignore */ }
  }

  const backToMain = () => {
    if (dirty) return // unsaved changes — user must save first
    setActiveFile(null)
    setActiveContent('')
  }

  const nonMainRefs = refs.filter(r => !r.is_main)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>
      {/* Top bar */}
      <TopBar
        label={isNew ? 'New Skill' : `Skill: ${name}`}
        dirty={dirty}
        onBack={onClose}
        onSave={activeFile ? saveRef : handleSave}
        canSave={!!(name.trim() && (instructions.trim() || activeFile))}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File tree (left) */}
        {!isNew && (
          <div style={{
            width: 200, borderRight: '1px solid var(--border)',
            overflowY: 'auto', background: 'var(--bg-sidebar)', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Folder header */}
            <div style={{
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--warning)" stroke="var(--warning)" strokeWidth="1">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {name || initialName}/
              </span>
            </div>

            {/* File tree */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              <TreeItem
                filename="SKILL.md" active={!activeFile} isLast={nonMainRefs.length === 0 && !showNewRef}
                onClick={backToMain}
              />
              {nonMainRefs.map((r, i) => (
                <TreeItem key={r.filename}
                  filename={r.filename} active={activeFile === r.filename}
                  isLast={i === nonMainRefs.length - 1 && !showNewRef}
                  onClick={() => openRef(r.filename)}
                  onDelete={() => deleteRef(r.filename)}
                  size={r.size}
                />
              ))}
              {showNewRef ? (
                <div style={{ padding: '3px 8px 3px 24px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, userSelect: 'none' }}>└</span>
                  <input value={newRefName} onChange={e => setNewRefName(e.target.value)}
                    placeholder="filename.md" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') addRef(); if (e.key === 'Escape') { setShowNewRef(false); setNewRefName('') } }}
                    style={{ flex: 1, padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              ) : (
                <button onClick={() => setShowNewRef(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px 5px 28px', textAlign: 'left', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add file
                </button>
              )}
            </div>
          </div>
        )}

        {/* Editor (right) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeFile ? (
            /* Ref file editor */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8 }}>
                {activeFile}
              </div>
              <textarea
                value={activeContent}
                onChange={e => { setActiveContent(e.target.value); setDirty(true) }}
                style={editorTextareaStyle}
              />
            </div>
          ) : (
            /* Main skill editor */
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <FormField label="Name" style={{ flex: 1 }}>
                    <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setDirty(true) }}
                      disabled={!isNew} placeholder="my-skill" style={inputStyle(!isNew)} />
                  </FormField>
                </div>
                <FormField label="Description">
                  <input value={description} onChange={e => { setDescription(e.target.value); setDirty(true) }}
                    placeholder='Use when... (trigger conditions for Claude)' style={inputStyle(false)} />
                </FormField>
                <FormField label="Instructions" flex>
                  <textarea
                    value={instructions}
                    onChange={e => { setInstructions(e.target.value); setDirty(true) }}
                    placeholder="Skill instructions in markdown. Reference other files with `./filename.md`"
                    style={{ ...editorTextareaStyle, minHeight: 320 }}
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Agent Studio ──

interface AgentRefFile { filename: string; size: number; is_main: boolean }

function AgentStudio({ name: initialName, onClose }: { name?: string; onClose: () => void }) {
  const isNew = !initialName
  const [name, setName] = useState(initialName || '')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [model, setModel] = useState('')
  const [refs, setRefs] = useState<AgentRefFile[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [newRefName, setNewRefName] = useState('')
  const [showNewRef, setShowNewRef] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) { nameRef.current?.focus(); return }
    window.api?.agents?.readClaude?.(initialName!)
      .then(data => {
        if (data) {
          setName(data.name)
          setDescription(data.description)
          setInstructions(data.instructions)
          setModel(data.model || '')
          setRefs(data.refs || [])
        }
      })
      .catch(() => {})
  }, [initialName, isNew])

  const loadRefs = async () => {
    if (!initialName) return
    try {
      const r = await window.api.agents.listRefs(initialName)
      setRefs(r || [])
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    const fileId = isNew ? name.trim().replace(/\s+/g, '-').toLowerCase() : initialName!
    if (!fileId || !instructions.trim()) return
    try {
      await window.api.agents.writeClaude(fileId, description.trim(), instructions.trim(), model || null)
      setDirty(false)
      if (isNew) {
        useAppStore.getState().openStudio('agent', fileId)
      }
    } catch { /* ignore */ }
  }

  const openRef = async (filename: string) => {
    if (!initialName) return
    if (activeFile && dirty) return // unsaved changes — user must save first
    try {
      const content = await window.api.agents.readRef(initialName, filename)
      setActiveFile(filename)
      setActiveContent(content)
      setDirty(false)
    } catch { /* ignore */ }
  }

  const saveRef = async () => {
    if (!initialName || !activeFile) return
    try {
      await window.api.agents.writeRef(initialName, activeFile, activeContent)
      setDirty(false)
      await loadRefs()
    } catch { /* ignore */ }
  }

  const addRef = async () => {
    if (!initialName || !newRefName.trim()) return
    const fn = newRefName.trim().endsWith('.md') ? newRefName.trim() : `${newRefName.trim()}.md`
    try {
      await window.api.agents.writeRef(initialName, fn, `# ${fn.replace('.md', '')}\n\n`)
      await loadRefs()
      setShowNewRef(false)
      setNewRefName('')
      openRef(fn)
    } catch { /* ignore */ }
  }

  const deleteRef = async (fn: string) => {
    if (!initialName) return
    try {
      await window.api.agents.deleteRef(initialName, fn)
      await loadRefs()
      if (activeFile === fn) { setActiveFile(null); setActiveContent('') }
    } catch { /* ignore */ }
  }

  const backToMain = () => {
    if (dirty) return // unsaved changes — user must save first
    setActiveFile(null)
    setActiveContent('')
  }

  const nonMainRefs = refs.filter(r => !r.is_main)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>
      <TopBar
        label={isNew ? 'New Agent' : `Agent: ${name}`}
        dirty={dirty}
        onBack={onClose}
        onSave={activeFile ? saveRef : handleSave}
        canSave={!!(name.trim() && (instructions.trim() || activeFile))}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File tree (left) */}
        {!isNew && (
          <div style={{
            width: 200, borderRight: '1px solid var(--border)',
            overflowY: 'auto', background: 'var(--bg-sidebar)', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Explorer header */}
            <div style={{
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6,
              borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Explorer
              </span>
            </div>

            {/* File tree */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {/* Main definition file */}
              <TreeItem
                filename={`${initialName}.md`} active={!activeFile}
                isLast={refs.length === 0 && !showNewRef}
                onClick={backToMain}
              />
              {/* Refs subfolder */}
              {refs.length > 0 && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px 4px 16px', fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}>
                    <span style={{ fontSize: 10, width: 10, textAlign: 'center' }}>├</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--warning)" stroke="var(--warning)" strokeWidth="1" style={{ opacity: 0.7 }}>
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <span>refs/</span>
                  </div>
                  {refs.map((r, i) => (
                    <div key={r.filename} style={{ paddingLeft: 12 }}>
                      <TreeItem
                        filename={r.filename} active={activeFile === r.filename}
                        isLast={i === refs.length - 1 && !showNewRef}
                        onClick={() => openRef(r.filename)}
                        onDelete={() => deleteRef(r.filename)}
                        size={r.size}
                      />
                    </div>
                  ))}
                </>
              )}
              {showNewRef ? (
                <div style={{ padding: '3px 8px 3px 36px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, userSelect: 'none' }}>└</span>
                  <input value={newRefName} onChange={e => setNewRefName(e.target.value)}
                    placeholder="filename.md" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') addRef(); if (e.key === 'Escape') { setShowNewRef(false); setNewRefName('') } }}
                    style={{ flex: 1, padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              ) : (
                <button onClick={() => setShowNewRef(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px 5px 28px', textAlign: 'left', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add ref
                </button>
              )}
            </div>
          </div>
        )}

        {/* Editor (right) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeFile ? (
            /* Ref file editor */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 8 }}>
                {activeFile}
              </div>
              <textarea
                value={activeContent}
                onChange={e => { setActiveContent(e.target.value); setDirty(true) }}
                style={editorTextareaStyle}
              />
            </div>
          ) : (
            /* Main agent editor */
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <FormField label="Name" style={{ flex: 1 }}>
                    <input ref={nameRef} value={name} onChange={e => { setName(e.target.value); setDirty(true) }}
                      disabled={!isNew} placeholder="my-agent" style={inputStyle(!isNew)} />
                  </FormField>
                  <FormField label="Model" style={{ width: 160 }}>
                    <select value={model} onChange={e => { setModel(e.target.value); setDirty(true) }} style={inputStyle(false)}>
                      <option value="">Default</option>
                      <option value="opus">Opus</option>
                      <option value="sonnet">Sonnet</option>
                      <option value="haiku">Haiku</option>
                    </select>
                  </FormField>
                </div>
                <FormField label="Description">
                  <input value={description} onChange={e => { setDescription(e.target.value); setDirty(true) }}
                    placeholder='[Tag] What this agent does, when to use it' style={inputStyle(false)} />
                </FormField>
                <FormField label="Instructions" flex>
                  <textarea
                    value={instructions}
                    onChange={e => { setInstructions(e.target.value); setDirty(true) }}
                    placeholder="Agent system prompt in markdown. Reference other files with `./filename.md`"
                    style={{ ...editorTextareaStyle, minHeight: 380 }}
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared components ──

function TopBar({ label, dirty, onBack, onSave, canSave }: {
  label: string; dirty: boolean; onBack: () => void; onSave: () => void; canSave: boolean
}) {
  return (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-sidebar)', flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
        fontSize: 12, color: 'var(--text-secondary)', background: 'none',
        border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
      }} className="hover:bg-[var(--bg-hover)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {label}
        {dirty && <span style={{ color: 'var(--warning)', marginLeft: 6, fontSize: 11, fontWeight: 400 }}>unsaved</span>}
      </span>
      <button onClick={onSave} disabled={!canSave}
        style={{
          padding: '5px 16px', fontSize: 12, fontWeight: 600,
          background: canSave ? 'var(--accent)' : 'var(--bg-hover)',
          color: canSave ? '#fff' : 'var(--text-muted)',
          border: 'none', borderRadius: 'var(--radius-md)',
          cursor: canSave ? 'pointer' : 'default',
        }}>
        Save
      </button>
    </div>
  )
}

function fileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const color = ext === 'md' ? 'var(--accent)' : ext === 'sh' ? 'var(--success)' : ext === 'json' ? 'var(--warning)' : 'var(--text-muted)'
  // Document icon
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function TreeItem({ filename, active, isLast, onClick, onDelete, size }: {
  filename: string; active: boolean; isLast: boolean; onClick: () => void
  onDelete?: () => void; size?: number
}) {
  return (
    <div
      onClick={onClick}
      className="hover:bg-[var(--bg-hover)]"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 8px 4px 16px', fontSize: 11, fontFamily: 'var(--font-mono)',
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer', transition: 'background 0.1s',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      <span style={{ color: 'var(--text-muted)', fontSize: 10, userSelect: 'none', flexShrink: 0, width: 10, textAlign: 'center' }}>
        {isLast ? '└' : '├'}
      </span>
      {fileIcon(filename)}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {filename}
      </span>
      {size != null && <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{formatBytes(size)}</span>}
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 10, padding: '0 2px', opacity: 0.4, flexShrink: 0, transition: 'opacity 0.15s' }}
          className="hover:opacity-100"
          title="Delete file"
        >
          ✕
        </button>
      )}
    </div>
  )
}

function FormField({ label, flex, style, children }: {
  label: string; flex?: boolean; style?: React.CSSProperties; children: React.ReactNode
}) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      ...(flex ? { flex: 1, display: 'flex', flexDirection: 'column' as const } : {}),
      ...style,
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
  display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
  fontSize: 13, fontFamily: 'var(--font-mono)',
  background: disabled ? 'var(--bg-hover)' : 'var(--bg-surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', outline: 'none',
})

const editorTextareaStyle: React.CSSProperties = {
  flex: 1, marginTop: 4, padding: '10px 12px',
  fontSize: 13, fontFamily: 'var(--font-mono)', lineHeight: 1.7,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
  tabSize: 2,
}
