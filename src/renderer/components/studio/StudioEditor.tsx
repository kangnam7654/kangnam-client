import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../../stores/app-store'
import { MonacoWrapper } from './MonacoWrapper'
import { StudioFileTree } from './StudioFileTree'
import { StudioBottomPanel } from './StudioBottomPanel'
import { ResizeHandle } from '../layout/ResizeHandle'
import { cliApi } from '../../lib/cli-api'

interface FileInfo {
  filename: string
  size: number
  is_main: boolean
}

interface StudioEditorProps {
  type: 'skill' | 'agent'
  name?: string
}

export function StudioEditor({ type, name: initialName }: StudioEditorProps) {
  const { closeStudio, setStudioDirty, studioState } = useAppStore()

  // Form state
  const [skillName, setSkillName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [model, setModel] = useState<string | null>(null)

  // File tree state
  const [refs, setRefs] = useState<FileInfo[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [refContent, setRefContent] = useState('')

  // Loading
  const [loading, setLoading] = useState(!!initialName)

  // Dirty tracking
  const [dirty, setDirty] = useState(false)
  const initialData = useRef({ name: '', description: '', instructions: '', model: null as string | null })

  // Bottom panel
  const [bottomHeight, setBottomHeight] = useState(200)

  // Load data
  useEffect(() => {
    if (!initialName) return
    const load = async () => {
      try {
        console.log('[StudioEditor] loading', type, initialName)
        if (type === 'skill') {
          const data = await window.api.claudeCommands.read(initialName)
          console.log('[StudioEditor] skill loaded', !!data)
          if (data) {
            setSkillName(data.name)
            setDescription(data.description)
            setInstructions(data.instructions)
            setRefs(data.refs)
            initialData.current = { name: data.name, description: data.description, instructions: data.instructions, model: null }
          }
        } else {
          const data = await window.api.agents.readClaude(initialName)
          console.log('[StudioEditor] agent loaded', !!data)
          if (data) {
            setSkillName(data.name)
            setDescription(data.description)
            setInstructions(data.instructions)
            setModel(data.model)
            setRefs(data.refs)
            initialData.current = { name: data.name, description: data.description, instructions: data.instructions, model: data.model }
          }
        }
      } catch (e) {
        console.error('[StudioEditor] load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [type, initialName])

  // Track dirty
  useEffect(() => {
    const isDirty = skillName !== initialData.current.name
      || description !== initialData.current.description
      || instructions !== initialData.current.instructions
      || model !== initialData.current.model
    setDirty(isDirty)
    setStudioDirty(isDirty)
  }, [skillName, description, instructions, model, setStudioDirty])

  // Keyboard shortcut: Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // Save
  const handleSave = useCallback(async () => {
    const saveName = initialName || skillName.toLowerCase().replace(/\s+/g, '-')
    if (!saveName) return

    try {
      if (type === 'skill') {
        await window.api.claudeCommands.write(saveName, description, instructions)
      } else {
        await window.api.agents.writeClaude(saveName, description, instructions, model)
      }
      initialData.current = { name: skillName, description, instructions, model }
      setDirty(false)
      setStudioDirty(false)

      // If new item, update studio state with name
      if (!initialName) {
        useAppStore.getState().openStudio(type, saveName)
      }
    } catch (e) {
      console.error('[StudioEditor] save error:', e)
    }
  }, [type, initialName, skillName, description, instructions, model, setStudioDirty])

  // Ref file operations
  const openRef = useCallback(async (filename: string) => {
    if (dirty) {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return
    }
    try {
      const name = initialName || skillName
      const content = type === 'skill'
        ? await window.api.claudeCommands.readRef(name, filename)
        : await window.api.agents.readRef(name, filename)
      setActiveFile(filename)
      setRefContent(content)
    } catch (e) {
      console.error('[StudioEditor] openRef error:', e)
    }
  }, [type, initialName, skillName, dirty])

  const saveRef = useCallback(async () => {
    if (!activeFile) return
    const name = initialName || skillName
    try {
      if (type === 'skill') {
        await window.api.claudeCommands.writeRef(name, activeFile, refContent)
      } else {
        await window.api.agents.writeRef(name, activeFile, refContent)
      }
    } catch (e) {
      console.error('[StudioEditor] saveRef error:', e)
    }
  }, [type, initialName, skillName, activeFile, refContent])

  const addRef = useCallback(async () => {
    const filename = prompt('파일 이름:')
    if (!filename) return
    const name = initialName || skillName
    try {
      if (type === 'skill') {
        await window.api.claudeCommands.writeRef(name, filename, '')
      } else {
        await window.api.agents.writeRef(name, filename, '')
      }
      // Reload refs
      const newRefs = type === 'skill'
        ? await window.api.claudeCommands.listRefs(name)
        : await window.api.agents.listRefs(name)
      setRefs(newRefs)
      setActiveFile(filename)
      setRefContent('')
    } catch (e) {
      console.error('[StudioEditor] addRef error:', e)
    }
  }, [type, initialName, skillName])

  const deleteRef = useCallback(async (filename: string) => {
    if (!confirm(`${filename} 파일을 삭제하시겠습니까?`)) return
    const name = initialName || skillName
    try {
      if (type === 'skill') {
        await window.api.claudeCommands.deleteRef(name, filename)
      } else {
        await window.api.agents.deleteRef(name, filename)
      }
      const newRefs = type === 'skill'
        ? await window.api.claudeCommands.listRefs(name)
        : await window.api.agents.listRefs(name)
      setRefs(newRefs)
      if (activeFile === filename) {
        setActiveFile(null)
        setRefContent('')
      }
    } catch (e) {
      console.error('[StudioEditor] deleteRef error:', e)
    }
  }, [type, initialName, skillName, activeFile])

  const backToMain = useCallback(() => {
    if (activeFile && refContent) {
      if (!confirm('저장하지 않은 ref 변경사항이 있습니다. 계속하시겠습니까?')) return
    }
    setActiveFile(null)
    setRefContent('')
  }, [activeFile, refContent])

  // AI actions via CLI session
  const currentSessionId = useAppStore((s) => s.currentSessionId)

  const sendToCliAndShowOutput = useCallback(async (message: string) => {
    if (!currentSessionId) {
      alert('CLI 세션이 필요합니다. 채팅에서 세션을 먼저 시작해주세요.')
      return
    }
    try {
      // Open bottom panel to CLI tab
      useAppStore.getState().setStudioBottomTab('cli')
      await cliApi.sendMessage(currentSessionId, message)
      useAppStore.getState().addMessage({ type: 'user_message', text: message })
      useAppStore.getState().setIsStreaming(true)
    } catch (e) {
      console.error('[StudioEditor] CLI send error:', e)
    }
  }, [currentSessionId])

  const handleAiGenerate = useCallback(() => {
    const skillCreator = type === 'skill' ? 'skill-creator' : 'agent-create'
    if (initialName) {
      // Improve existing
      const msg = `Use the /${skillCreator} skill to improve the ${type} "${initialName}". Read the current ${type} file, analyze it, and suggest improvements. Apply the improvements directly to the file.`
      sendToCliAndShowOutput(msg)
    } else {
      // Generate new — use name/description if provided
      const context = skillName ? `Name: "${skillName}". ` : ''
      const desc = description ? `Description: "${description}". ` : ''
      const msg = `Use the /${skillCreator} skill to create a new ${type}. ${context}${desc}Ask me clarifying questions if needed, then generate the ${type} file.`
      sendToCliAndShowOutput(msg)
    }
  }, [type, initialName, skillName, description, sendToCliAndShowOutput])

  const handleValidate = useCallback(() => {
    if (!initialName) {
      alert('먼저 저장해주세요.')
      return
    }
    if (type === 'skill') {
      const msg = `Validate the skill "${initialName}" by running quick_validate.py from the skill-creator plugin on its SKILL.md. Report any issues found.`
      sendToCliAndShowOutput(msg)
    } else {
      // Agent uses doc-critic quality gate
      const msg = `Use the /agent-create skill to run the quality gate (doc-critic in LLM mode) on the agent "${initialName}". Report the score and any issues.`
      sendToCliAndShowOutput(msg)
    }
  }, [type, initialName, sendToCliAndShowOutput])

  const handleRunTests = useCallback(() => {
    if (!initialName) {
      alert('먼저 저장해주세요.')
      return
    }
    const skillCreator = type === 'skill' ? 'skill-creator' : 'agent-create'
    const msg = `Use the /${skillCreator} skill to run test cases for the ${type} "${initialName}". Create 2-3 test prompts if none exist, run them with baseline comparison, and launch the eval viewer.`
    sendToCliAndShowOutput(msg)
  }, [type, initialName, sendToCliAndShowOutput])

  const handleOptimize = useCallback(() => {
    if (!initialName) {
      alert('먼저 저장해주세요.')
      return
    }
    const skillCreator = type === 'skill' ? 'skill-creator' : 'agent-create'
    const msg = `Use the /${skillCreator} skill to optimize the description for the ${type} "${initialName}". Generate trigger eval queries, review them with me, then run the optimization loop.`
    sendToCliAndShowOutput(msg)
  }, [type, initialName, sendToCliAndShowOutput])

  const handleBottomResize = (delta: number) => {
    setBottomHeight((h) => Math.min(500, Math.max(100, h - delta)))
  }

  const bottomTab = studioState?.bottomTab || 'cli'
  const bottomVisible = studioState?.bottomPanelVisible || false

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid var(--border)', gap: 8, flexShrink: 0,
      }}>
        <button
          onClick={() => {
            if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 나가시겠습니까?')) return
            closeStudio()
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Dashboard
        </button>

        <div style={{ flex: 1 }} />

        {/* AI action buttons */}
        <ToolbarButton
          label={initialName ? 'AI Improve' : 'AI Generate'}
          icon={<SparkleIcon />}
          onClick={handleAiGenerate}
          variant="ghost"
        />
        {initialName && (
          <>
            <ToolbarButton label="Validate" icon={<CheckIcon />} onClick={handleValidate} variant="ghost" />
            <ToolbarButton label="Run Tests" icon={<PlayIcon />} onClick={handleRunTests} variant="ghost" />
            <ToolbarButton label="Optimize" icon={<TuneIcon />} onClick={handleOptimize} variant="ghost" />
          </>
        )}

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {dirty && (
          <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>UNSAVED</span>
        )}

        <span style={{ fontSize: 10, color: type === 'skill' ? 'var(--accent)' : '#22c55e', fontWeight: 600 }}>
          {type.toUpperCase()}
        </span>

        <button
          onClick={activeFile ? saveRef : handleSave}
          style={{
            padding: '5px 14px', fontSize: 11, fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', opacity: (activeFile ? true : dirty) ? 1 : 0.5,
          }}
        >
          Save{activeFile ? ` (${activeFile})` : ''}
        </button>
      </div>

      {/* Main area: file tree + editor */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading {type}...
        </div>
      ) : (
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* File tree */}
        {initialName && (
          <StudioFileTree
            type={type}
            name={initialName}
            files={refs}
            activeFile={activeFile}
            onSelect={(f) => f ? openRef(f) : backToMain()}
            onAddFile={addRef}
            onDeleteFile={deleteRef}
          />
        )}

        {/* Editor area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeFile ? (
            /* Ref file editor — full Monaco */
            <div style={{ flex: 1 }}>
              <MonacoWrapper
                value={refContent}
                onChange={setRefContent}
                language={activeFile.endsWith('.py') ? 'python' : activeFile.endsWith('.sh') ? 'shell' : activeFile.endsWith('.json') ? 'json' : 'markdown'}
              />
            </div>
          ) : (
            /* Main file — hybrid form + Monaco */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              {/* Form fields */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <FormField label="Name">
                  <input
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder={type === 'skill' ? 'skill-name' : 'agent-name'}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Description">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this do? When should it trigger?"
                    style={inputStyle}
                  />
                </FormField>
                {type === 'agent' && (
                  <FormField label="Model">
                    <select
                      value={model || ''}
                      onChange={(e) => setModel(e.target.value || null)}
                      style={{ ...inputStyle, width: 180 }}
                    >
                      <option value="">Default</option>
                      <option value="opus">Opus</option>
                      <option value="sonnet">Sonnet</option>
                      <option value="haiku">Haiku</option>
                    </select>
                  </FormField>
                )}
              </div>

              {/* Instructions — Monaco */}
              <div style={{ flex: 1, minHeight: 200 }}>
                <MonacoWrapper
                  value={instructions}
                  onChange={setInstructions}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Bottom panel */}
      {bottomVisible && (
        <>
          <ResizeHandle side="bottom" onResize={handleBottomResize} />
          <StudioBottomPanel
            activeTab={bottomTab}
            height={bottomHeight}
            type={type}
            skillOrAgentName={initialName || skillName}
          />
        </>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', width: 80, flexShrink: 0, textAlign: 'right' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '5px 10px', fontSize: 12,
  background: 'var(--bg-main)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  outline: 'none',
}

// ── Toolbar components ──

function ToolbarButton({ label, icon, onClick, variant }: {
  label: string; icon: React.ReactNode; onClick: () => void; variant: 'ghost' | 'primary'
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', fontSize: 11, fontWeight: 500,
        background: variant === 'primary' ? 'var(--accent)' : 'transparent',
        color: variant === 'primary' ? '#fff' : 'var(--text-secondary)',
        border: variant === 'primary' ? 'none' : '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v1m0 16v1m-7.07-2.93l.71-.71m12.02-12.02l.71-.71M3 12h1m16 0h1m-2.93 7.07l-.71-.71M5.64 5.64l-.71-.71" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function TuneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}
