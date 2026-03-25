import { useEffect, useState } from 'react'
import { useAppStore, type Prompt } from '../../../stores/app-store'

interface EditingRef {
  id?: string
  name: string
  content: string
}

interface EditingSkill {
  id?: string
  name: string
  description: string
  instructions: string
  references: EditingRef[]
}

interface GradeExpectation { text: string; passed: boolean; evidence: string }
interface GradeResult {
  expectations: GradeExpectation[]
  summary: { passed: number; failed: number; total: number; pass_rate: number }
  claims: Array<{ claim: string; type: string; verified: boolean; evidence: string }>
  eval_feedback: { suggestions: Array<{ reason: string; assertion?: string }>; overall: string }
}

interface CompareResult {
  winner: 'A' | 'B' | 'TIE'
  reasoning: string
  rubric: Record<string, { content_score: number; structure_score: number; effectiveness_score: number; overall_score: number }>
  output_quality: Record<string, { strengths: string[]; weaknesses: string[] }>
  mapping: { A: 'first' | 'second'; B: 'first' | 'second' }
}

interface AnalyzeResult {
  winner_analysis: { key_strengths: string[]; what_worked: string }
  loser_analysis: { key_weaknesses: string[]; what_failed: string }
  improvements: Array<{ category: string; suggestion: string; priority: string }>
  summary: string
}

/** File tree view for references — groups by directory */
function RefTree({ refs, updateRef, removeRef }: {
  refs: EditingRef[]
  updateRef: (idx: number, field: 'name' | 'content', value: string) => void
  removeRef: (idx: number) => void
}) {
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set())
  const [openFile, setOpenFile] = useState<number | null>(null)

  // Group refs by directory
  const tree = new Map<string, Array<{ ref: EditingRef; idx: number }>>()
  refs.forEach((ref, idx) => {
    const slash = ref.name.lastIndexOf('/')
    const dir = slash > 0 ? ref.name.slice(0, slash) : ''
    const list = tree.get(dir) ?? []
    list.push({ ref, idx })
    tree.set(dir, list)
  })

  const toggleDir = (dir: string) => {
    const next = new Set(openDirs)
    next.has(dir) ? next.delete(dir) : next.add(dir)
    setOpenDirs(next)
  }

  const fileName = (name: string) => {
    const slash = name.lastIndexOf('/')
    return slash > 0 ? name.slice(slash + 1) : name
  }

  const dirEntries = Array.from(tree.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div style={{
      borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border)',
      overflow: 'hidden', fontSize: 12.5
    }}>
      {dirEntries.map(([dir, files]) => {
        const isRoot = dir === ''
        const dirOpen = isRoot || openDirs.has(dir)
        return (
          <div key={dir}>
            {/* Directory header */}
            {!isRoot && (
              <div
                onClick={() => toggleDir(dir)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', cursor: 'pointer', userSelect: 'none',
                  borderTop: '1px solid var(--border)'
                }}
                className="hover:bg-[rgba(255,255,255,0.03)]"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: dirOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill={dirOpen ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)'} />
                </svg>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{dir}/</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{files.length}</span>
              </div>
            )}
            {/* Files */}
            {dirOpen && files.map(({ ref, idx }) => {
              const isOpen = openFile === idx
              const lines = ref.content ? ref.content.split('\n').length : 0
              return (
                <div key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  <div
                    onClick={() => setOpenFile(isOpen ? null : idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', paddingLeft: isRoot ? 10 : 28,
                      cursor: 'pointer', userSelect: 'none'
                    }}
                    className="hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="rgba(255,255,255,0.04)" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName(ref.name) || 'untitled'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {lines > 0 ? `${lines}L` : ''}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); removeRef(idx) }}
                      style={{
                        width: 18, height: 18, borderRadius: 4, border: 'none',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, opacity: 0.6
                      }}
                      className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)] hover:opacity-100"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 10px 8px', paddingLeft: isRoot ? 10 : 28 }}>
                      <input
                        value={ref.name}
                        onChange={e => updateRef(idx, 'name', e.target.value)}
                        placeholder="path/to/file.md"
                        style={{
                          width: '100%', padding: '4px 0', marginBottom: 4,
                          background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                          fontSize: 12, color: 'var(--text-secondary)', outline: 'none',
                          fontFamily: "'SF Mono', Monaco, Menlo, monospace"
                        }}
                        className="placeholder-[var(--text-muted)]"
                      />
                      <textarea
                        value={ref.content}
                        onChange={e => updateRef(idx, 'content', e.target.value)}
                        placeholder="File content..."
                        rows={8}
                        style={{
                          width: '100%', padding: '6px 0',
                          background: 'transparent', border: 'none',
                          fontSize: 11.5, color: 'var(--text-primary)', outline: 'none',
                          fontFamily: "'SF Mono', Monaco, Menlo, monospace",
                          resize: 'vertical', lineHeight: 1.5
                        }}
                        className="placeholder-[var(--text-muted)]"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** Sparkle icon for AI buttons */
function SparkleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{children}</h3>
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{children}</p>
}

export function PromptsTab() {
  const { prompts, setPrompts, activeProvider, activeModel, setEvalSelectedSkillId, setShowEval } = useAppStore()
  const [editing, setEditing] = useState<EditingSkill | null>(null)
  const [aiLoading, setAiLoading] = useState<string | null>(null) // 'generate' | 'improve' | 'ref' | 'grade' | 'compare' | 'analyze' | null
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showImprove, setShowImprove] = useState(false)
  const [improveFeedback, setImproveFeedback] = useState('')
  const [showAiRef, setShowAiRef] = useState(false)
  const [aiRefPrompt, setAiRefPrompt] = useState('')
  // Sub-agent state
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [showGrade, setShowGrade] = useState(false)
  const [gradeCriteria, setGradeCriteria] = useState('Clear instructions\nGood examples\nEdge case coverage\nAppropriate scope\nEffective description')
  const [showCompare, setShowCompare] = useState(false)

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    const list = await window.api.prompts.list() as Prompt[]
    setPrompts(list)
  }

  const handleSave = async () => {
    if (!editing) return
    const { name, description, instructions } = editing
    if (!name.trim() || !instructions.trim()) return

    if (editing.id) {
      await window.api.prompts.update(editing.id, name.trim(), description.trim(), instructions.trim())
      const existing = await window.api.prompts.refList(editing.id) as { id: string }[]
      const existingIds = new Set(existing.map((r: { id: string }) => r.id))
      const editingIds = new Set(editing.references.filter(r => r.id).map(r => r.id))
      for (const r of existing) {
        if (!editingIds.has(r.id)) await window.api.prompts.refDelete(r.id)
      }
      for (const r of editing.references) {
        if (r.id && existingIds.has(r.id)) {
          await window.api.prompts.refUpdate(r.id, r.name.trim(), r.content.trim())
        } else if (r.name.trim() && r.content.trim()) {
          await window.api.prompts.refAdd(editing.id, r.name.trim(), r.content.trim())
        }
      }
    } else {
      const created = await window.api.prompts.create(name.trim(), description.trim(), instructions.trim()) as { id: string }
      for (const r of editing.references) {
        if (r.name.trim() && r.content.trim()) {
          await window.api.prompts.refAdd(created.id, r.name.trim(), r.content.trim())
        }
      }
    }
    setEditing(null)
    await loadPrompts()
  }

  const handleDelete = async (id: string) => {
    await window.api.prompts.delete(id)
    await loadPrompts()
  }

  const addRef = () => {
    if (!editing) return
    setEditing({ ...editing, references: [...editing.references, { name: '', content: '' }] })
  }

  const updateRef = (idx: number, field: 'name' | 'content', value: string) => {
    if (!editing) return
    const refs = [...editing.references]
    refs[idx] = { ...refs[idx], [field]: value }
    setEditing({ ...editing, references: refs })
  }

  const removeRef = (idx: number) => {
    if (!editing) return
    setEditing({ ...editing, references: editing.references.filter((_, i) => i !== idx) })
  }

  // ── AI Actions ──

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading('generate')
    setAiError(null)
    try {
      const result = await window.api.prompts.aiGenerate(aiPrompt.trim(), activeProvider, activeModel) as { name: string; description: string; instructions: string }
      setEditing({ name: result.name, description: result.description, instructions: result.instructions, references: [] })
      setShowAiGenerate(false)
      setAiPrompt('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleAiImprove = async () => {
    if (!editing || !improveFeedback.trim()) return
    setAiLoading('improve')
    setAiError(null)
    try {
      const result = await window.api.prompts.aiImprove(
        { name: editing.name, description: editing.description, instructions: editing.instructions },
        improveFeedback.trim(), activeProvider, activeModel
      ) as { name: string; description: string; instructions: string }
      setEditing({ ...editing, name: result.name, description: result.description, instructions: result.instructions })
      setShowImprove(false)
      setImproveFeedback('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleAiRef = async () => {
    if (!editing || !aiRefPrompt.trim()) return
    setAiLoading('ref')
    setAiError(null)
    try {
      const result = await window.api.prompts.aiGenerateRef(editing.instructions, aiRefPrompt.trim(), activeProvider, activeModel) as { name: string; content: string }
      setEditing({ ...editing, references: [...editing.references, { name: result.name, content: result.content }] })
      setShowAiRef(false)
      setAiRefPrompt('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  // ── Sub-Agent Actions ──

  const handleGrade = async () => {
    if (!editing) return
    const criteria = gradeCriteria.split('\n').map(c => c.trim()).filter(Boolean)
    if (criteria.length === 0) return
    setAiLoading('grade')
    setAiError(null)
    setGradeResult(null)
    try {
      const result = await window.api.prompts.aiGrade(
        { name: editing.name, description: editing.description, instructions: editing.instructions },
        criteria, activeProvider, activeModel
      )
      setGradeResult(result as GradeResult)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleCompare = async () => {
    if (!editing || !editing.id) return
    const saved = prompts.find(p => p.id === editing.id)
    if (!saved) return
    setAiLoading('compare')
    setAiError(null)
    setCompareResult(null)
    setAnalyzeResult(null)
    try {
      const result = await window.api.prompts.aiCompare(
        { name: saved.name, description: saved.description || '', instructions: saved.instructions },
        { name: editing.name, description: editing.description, instructions: editing.instructions },
        activeProvider, activeModel
      )
      setCompareResult(result as CompareResult)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const handleAnalyze = async () => {
    if (!editing || !editing.id || !compareResult) return
    const saved = prompts.find(p => p.id === editing.id)
    if (!saved) return
    setAiLoading('analyze')
    setAiError(null)
    try {
      // Determine winner/loser from mapping
      const winnerIsFirst = compareResult.mapping[compareResult.winner as 'A' | 'B'] === 'first'
      const winnerSkill = (compareResult.winner === 'TIE')
        ? { name: editing.name, description: editing.description, instructions: editing.instructions }
        : winnerIsFirst
          ? { name: saved.name, description: saved.description || '', instructions: saved.instructions }
          : { name: editing.name, description: editing.description, instructions: editing.instructions }
      const loserSkill = (compareResult.winner === 'TIE')
        ? { name: saved.name, description: saved.description || '', instructions: saved.instructions }
        : winnerIsFirst
          ? { name: editing.name, description: editing.description, instructions: editing.instructions }
          : { name: saved.name, description: saved.description || '', instructions: saved.instructions }
      const result = await window.api.prompts.aiAnalyze(
        compareResult, winnerSkill, loserSkill, activeProvider, activeModel
      )
      setAnalyzeResult(result as AnalyzeResult)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(null)
    }
  }

  const closeEditing = () => {
    setEditing(null)
    setAiError(null)
    setShowImprove(false)
    setShowAiRef(false)
    setShowGrade(false)
    setShowCompare(false)
    setGradeResult(null)
    setCompareResult(null)
    setAnalyzeResult(null)
  }

  // ── AI Generate overlay (shown before editing) ──
  if (showAiGenerate && !editing) {
    return (
      <div>
        <SectionTitle>AI Skill Generator</SectionTitle>
        <SectionDesc>Describe what you want the skill to do and AI will create a draft.</SectionDesc>

        {aiError && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {aiError}
          </div>
        )}

        <textarea
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="e.g. A skill for reviewing Python code with focus on PEP 8, type hints, security vulnerabilities, and performance. Should output a structured review with severity levels."
          rows={5}
          autoFocus
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            background: 'var(--bg-main)', border: '1px solid var(--border)',
            fontSize: 13, color: 'var(--text-primary)', outline: 'none',
            fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
            transition: 'border-color 0.15s'
          }}
          className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiGenerate() }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => { setShowAiGenerate(false); setAiPrompt(''); setAiError(null) }}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            className="hover:bg-[rgba(255,255,255,0.1)]"
          >
            Cancel
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={!aiPrompt.trim() || aiLoading === 'generate'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: aiLoading ? 'wait' : 'pointer', transition: 'all 0.15s',
              opacity: (!aiPrompt.trim() || aiLoading === 'generate') ? 0.5 : 1
            }}
          >
            {aiLoading === 'generate' ? (
              <>
                <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                Generating...
              </>
            ) : (
              <>
                <SparkleIcon />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Skill list (compact) + Edit modal ──
  return (
    <div>
      {/* Edit modal overlay */}
      {editing && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)'
          }}
          onClick={closeEditing}
        >
          <div
            style={{
              width: 720, maxHeight: '90vh',
              background: 'var(--bg-sidebar)', borderRadius: 16,
              border: '1px solid var(--border)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {editing.id ? 'Edit Skill' : 'New Skill'}
              </span>
              <button
                onClick={closeEditing}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
                }}
                className="hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div>
        <SectionDesc>Define a skill that shapes the assistant's behavior for specific tasks.</SectionDesc>

        {aiError && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
            {aiError}
            <button onClick={() => setAiError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>dismiss</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Name
            </label>
            <input
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. Code Review"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                fontSize: 14, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s'
              }}
              className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Description
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— when to use this skill</span>
            </label>
            <input
              value={editing.description}
              onChange={e => setEditing({ ...editing, description: e.target.value })}
              placeholder="e.g. Use when reviewing code for bugs, performance, and best practices"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', transition: 'border-color 0.15s'
              }}
              className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Instructions
              </label>
              <button
                onClick={() => { setShowImprove(!showImprove); setAiError(null) }}
                disabled={!editing.instructions.trim() || !!aiLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: showImprove ? 'rgba(139,92,246,0.15)' : 'transparent',
                  color: showImprove ? '#a78bfa' : 'var(--text-muted)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  opacity: (!editing.instructions.trim() || !!aiLoading) ? 0.4 : 1
                }}
                className="hover:bg-[rgba(139,92,246,0.1)] hover:text-[#a78bfa]"
              >
                <SparkleIcon size={11} />
                AI Improve
              </button>
            </div>
            {showImprove && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <input
                  value={improveFeedback}
                  onChange={e => setImproveFeedback(e.target.value)}
                  placeholder="What should be improved? e.g. Add more edge cases, make output format clearer..."
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
                    fontSize: 12.5, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit'
                  }}
                  className="placeholder-[var(--text-muted)]"
                  onKeyDown={e => { if (e.key === 'Enter') handleAiImprove() }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                  <button onClick={() => { setShowImprove(false); setImproveFeedback('') }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={handleAiImprove}
                    disabled={!improveFeedback.trim() || aiLoading === 'improve'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 6, border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
                      fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: (!improveFeedback.trim() || aiLoading === 'improve') ? 0.5 : 1
                    }}
                  >
                    {aiLoading === 'improve' ? 'Improving...' : 'Apply'}
                  </button>
                </div>
              </div>
            )}
            <textarea
              value={editing.instructions}
              onChange={e => setEditing({ ...editing, instructions: e.target.value })}
              placeholder="You are an expert..."
              rows={10}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: 'var(--bg-main)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
                transition: 'border-color 0.15s'
              }}
              className="placeholder-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>

          {/* References section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                References
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>— API docs, examples, etc.</span>
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => { setShowAiRef(!showAiRef); setAiError(null) }}
                  disabled={!editing.instructions.trim() || !!aiLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: showAiRef ? 'rgba(139,92,246,0.15)' : 'transparent',
                    color: showAiRef ? '#a78bfa' : 'var(--text-muted)',
                    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    opacity: (!editing.instructions.trim() || !!aiLoading) ? 0.4 : 1
                  }}
                  className="hover:bg-[rgba(139,92,246,0.1)] hover:text-[#a78bfa]"
                >
                  <SparkleIcon size={11} />
                  AI
                </button>
                <button
                  onClick={addRef}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                    fontSize: 12, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(255,255,255,0.1)] hover:text-[var(--text-primary)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              </div>
            </div>
            {showAiRef && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <input
                  value={aiRefPrompt}
                  onChange={e => setAiRefPrompt(e.target.value)}
                  placeholder="What reference to generate? e.g. REST API schema for user endpoints, React component patterns..."
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
                    fontSize: 12.5, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit'
                  }}
                  className="placeholder-[var(--text-muted)]"
                  onKeyDown={e => { if (e.key === 'Enter') handleAiRef() }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                  <button onClick={() => { setShowAiRef(false); setAiRefPrompt('') }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={handleAiRef}
                    disabled={!aiRefPrompt.trim() || aiLoading === 'ref'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 6, border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
                      fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: (!aiRefPrompt.trim() || aiLoading === 'ref') ? 0.5 : 1
                    }}
                  >
                    {aiLoading === 'ref' ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            )}
            {editing.references.length === 0 && !showAiRef ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No references yet.
              </div>
            ) : (
              <RefTree refs={editing.references} updateRef={updateRef} removeRef={removeRef} />
            )}
          </div>

          {/* Sub-Agent: Grade & Compare */}
          {editing.instructions.trim() && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Quality Check</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => { setShowGrade(!showGrade); setShowCompare(false); setGradeResult(null) }}
                    disabled={!!aiLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: showGrade ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: showGrade ? 'var(--success-text)' : 'var(--text-muted)',
                      fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                      opacity: aiLoading ? 0.4 : 1
                    }}
                    className="hover:bg-[rgba(16,185,129,0.1)] hover:text-[var(--success-text)]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    Grade
                  </button>
                  {editing.id && (
                    <button
                      onClick={() => { setShowCompare(!showCompare); setShowGrade(false); setCompareResult(null); setAnalyzeResult(null) }}
                      disabled={!!aiLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6, border: 'none',
                        background: showCompare ? 'rgba(59,130,246,0.15)' : 'transparent',
                        color: showCompare ? 'var(--info)' : 'var(--text-muted)',
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                        opacity: aiLoading ? 0.4 : 1
                      }}
                      className="hover:bg-[rgba(59,130,246,0.1)] hover:text-[var(--info)]"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      Compare
                    </button>
                  )}
                </div>
              </div>

              {/* Grade panel */}
              {showGrade && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                    Criteria (one per line)
                  </label>
                  <textarea
                    value={gradeCriteria}
                    onChange={e => setGradeCriteria(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
                      fontSize: 12.5, color: 'var(--text-primary)', outline: 'none',
                      fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6
                    }}
                    className="placeholder-[var(--text-muted)]"
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                    <button onClick={() => { setShowGrade(false); setGradeResult(null) }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={handleGrade}
                      disabled={!gradeCriteria.trim() || aiLoading === 'grade'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 12px', borderRadius: 6, border: 'none',
                        background: '#10b981', color: 'white',
                        fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                        opacity: (!gradeCriteria.trim() || aiLoading === 'grade') ? 0.5 : 1
                      }}
                    >
                      {aiLoading === 'grade' ? 'Grading...' : 'Run Grade'}
                    </button>
                  </div>

                  {/* Grade results */}
                  {gradeResult && (
                    <div style={{ marginTop: 12, borderTop: '1px solid rgba(16,185,129,0.12)', paddingTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: gradeResult.summary.pass_rate >= 0.8 ? 'var(--success-text)' : gradeResult.summary.pass_rate >= 0.5 ? 'var(--warning)' : 'var(--danger-text)' }}>
                          {Math.round(gradeResult.summary.pass_rate * 100)}% pass rate
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          ({gradeResult.summary.passed}/{gradeResult.summary.total})
                        </span>
                      </div>
                      {gradeResult.expectations.map((exp, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < gradeResult.expectations.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ fontSize: 12, flexShrink: 0, color: exp.passed ? 'var(--success-text)' : 'var(--danger-text)' }}>
                            {exp.passed ? 'PASS' : 'FAIL'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{exp.text}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{exp.evidence}</div>
                          </div>
                        </div>
                      ))}
                      {gradeResult.eval_feedback.overall && (
                        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {gradeResult.eval_feedback.overall}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Compare panel */}
              {showCompare && editing.id && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
                    Compare the saved version against your current edits using a blind A/B test.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button onClick={() => { setShowCompare(false); setCompareResult(null); setAnalyzeResult(null) }} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button
                      onClick={handleCompare}
                      disabled={aiLoading === 'compare'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 12px', borderRadius: 6, border: 'none',
                        background: '#3b82f6', color: 'white',
                        fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                        opacity: aiLoading === 'compare' ? 0.5 : 1
                      }}
                    >
                      {aiLoading === 'compare' ? 'Comparing...' : 'Run Compare'}
                    </button>
                  </div>

                  {/* Compare results */}
                  {compareResult && (
                    <div style={{ marginTop: 12, borderTop: '1px solid rgba(59,130,246,0.12)', paddingTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: compareResult.winner === 'TIE' ? 'var(--warning)' : 'var(--info)' }}>
                          {compareResult.winner === 'TIE' ? 'Tie' : `Winner: ${compareResult.mapping[compareResult.winner] === 'first' ? 'Saved' : 'Current Edit'}`}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                        {compareResult.reasoning}
                      </div>

                      {/* Rubric scores */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        {['A', 'B'].map(label => {
                          const scores = compareResult.rubric[label]
                          const who = compareResult.mapping[label as 'A' | 'B'] === 'first' ? 'Saved' : 'Current'
                          return (
                            <div key={label} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{who}</div>
                              {scores && ['content_score', 'structure_score', 'effectiveness_score'].map(key => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', padding: '1px 0' }}>
                                  <span>{key.replace('_score', '').replace('_', ' ')}</span>
                                  <span style={{ color: 'var(--text-secondary)' }}>{scores[key as keyof typeof scores]}/5</span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>

                      {/* Analyze button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleAnalyze}
                          disabled={aiLoading === 'analyze'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 12px', borderRadius: 6, border: 'none',
                            background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                            fontSize: 12, cursor: aiLoading ? 'wait' : 'pointer',
                            opacity: aiLoading === 'analyze' ? 0.5 : 1
                          }}
                        >
                          {aiLoading === 'analyze' ? 'Analyzing...' : 'Analyze & Get Suggestions'}
                        </button>
                      </div>

                      {/* Analyze results */}
                      {analyzeResult && (
                        <div style={{ marginTop: 10, borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 10 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                            {analyzeResult.summary}
                          </div>
                          {analyzeResult.improvements.length > 0 && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Suggestions</div>
                              {analyzeResult.improvements.map((imp, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < analyzeResult.improvements.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, flexShrink: 0, padding: '1px 5px', borderRadius: 4,
                                    background: imp.priority === 'high' ? 'rgba(239,68,68,0.12)' : imp.priority === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
                                    color: imp.priority === 'high' ? 'var(--danger-text)' : imp.priority === 'medium' ? 'var(--warning)' : 'var(--text-muted)',
                                    textTransform: 'uppercase'
                                  }}>
                                    {imp.priority}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>[{imp.category}]</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{imp.suggestion}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={closeEditing}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
              }}
              className="hover:bg-[rgba(255,255,255,0.1)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editing.name.trim() || !editing.instructions.trim()}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: 'white',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                opacity: (!editing.name.trim() || !editing.instructions.trim()) ? 0.4 : 1
              }}
              className="hover:opacity-85"
            >
              Save
            </button>
          </div>
        </div>
      </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <SectionTitle>Skills</SectionTitle>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setShowAiGenerate(true); setAiError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, var(--accent))', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}
            className="hover:opacity-85"
          >
            <SparkleIcon size={13} />
            AI Generate
          </button>
          <button
            onClick={() => setEditing({ name: '', description: '', instructions: '', references: [] })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'white',
              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}
            className="hover:opacity-85"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>
      </div>
      <SectionDesc>Skills shape the assistant's behavior — select one before starting a conversation.</SectionDesc>

      {prompts.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No skills yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {prompts.map(prompt => (
            <div key={prompt.id} style={{
              padding: '8px 12px', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              cursor: 'pointer', transition: 'background 0.12s'
            }}
              className="hover:bg-[rgba(255,255,255,0.04)]"
              onClick={() => setEditing({
                id: prompt.id,
                name: prompt.name,
                description: prompt.description || '',
                instructions: prompt.instructions,
                references: prompt.references.map(r => ({ id: r.id, name: r.name, content: r.content }))
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
                </svg>
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prompt.name}
                </span>
                {prompt.references.length > 0 && (
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {prompt.references.length} ref
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setEvalSelectedSkillId(prompt.id)
                    setShowEval(true)
                  }}
                  title="Eval"
                  style={{
                    width: 26, height: 26, borderRadius: 5, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(16,185,129,0.1)] hover:text-[var(--success-text)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  title="Delete"
                  style={{
                    width: 26, height: 26, borderRadius: 5, border: 'none',
                    background: 'transparent', color: 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                  className="hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
