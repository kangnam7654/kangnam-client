import { useState } from 'react'
import type { UnifiedMessage } from '../../stores/app-store'

interface MessageRendererProps {
  message: UnifiedMessage
}

export function MessageRenderer({ message }: MessageRendererProps) {
  switch (message.type) {
    case 'user_message':
      return <UserMessage text={message.text} />
    case 'text_delta':
      return <AssistantText text={message.text} />
    case 'tool_use_start':
      return <ToolUseCard id={message.id} name={message.name} input={message.input} />
    case 'tool_result':
      return <ToolResultCard id={message.id} output={message.output} isError={message.is_error} />
    case 'agent_start':
      return <AgentStartCard id={message.id} name={message.name} description={message.description} />
    case 'agent_progress':
      return <AgentProgressCard id={message.id} message={message.message} />
    case 'agent_end':
      return <AgentEndCard id={message.id} result={message.result} />
    case 'error':
      return <ErrorMessage message={message.message} />
    case 'turn_end':
      return <TurnEndIndicator usage={message.usage} />
    default:
      return null
  }
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-6">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--bg-user-bubble)] px-4 py-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed selectable">
        {text}
      </div>
    </div>
  )
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="mb-6 text-[15px] text-[var(--text-primary)] whitespace-pre-wrap leading-[1.7] selectable" style={{ fontFamily: 'var(--font-serif)' }}>
      {text}
    </div>
  )
}

function ToolUseCard({ id: _id, name, input }: { id: string; name: string; input: unknown }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="my-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
        <span className="font-medium flex-1 truncate">{name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <pre className="px-3.5 pb-3 overflow-x-auto text-xs text-[var(--text-muted)] font-mono leading-relaxed">
          {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ToolResultCard({ id: _id, output, isError }: { id: string; output: string; isError: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const preview = output.length > 120 ? output.slice(0, 120) + '...' : output
  return (
    <div className={`my-2 rounded-xl border overflow-hidden ${
      isError ? 'border-red-500/20 bg-red-500/5' : 'border-green-500/20 bg-green-500/5'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3.5 py-2 text-left text-xs font-mono"
      >
        <span className={isError ? 'text-red-400' : 'text-green-400'}>
          {isError ? '✗' : '✓'}
        </span>
        <span className={`flex-1 truncate ${isError ? 'text-red-400' : 'text-green-400'}`}>
          {expanded ? 'Output' : preview}
        </span>
        {output.length > 120 && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {expanded && (
        <pre className="px-3.5 pb-3 overflow-x-auto whitespace-pre-wrap text-xs font-mono text-[var(--text-secondary)] selectable">
          {output}
        </pre>
      )}
    </div>
  )
}

function AgentStartCard({ id: _id, name, description }: { id: string; name: string; description: string }) {
  return (
    <div className="my-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
      <div className="flex items-center gap-2.5 text-sm font-medium text-blue-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
        Agent: {name}
      </div>
      {description && <p className="mt-1.5 text-xs text-[var(--text-muted)]">{description}</p>}
    </div>
  )
}

function AgentProgressCard({ id: _id, message }: { id: string; message: string }) {
  return (
    <div className="ml-4 mb-2 border-l-2 border-blue-500/20 pl-3.5 text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
      {message}
    </div>
  )
}

function AgentEndCard({ id: _id, result }: { id: string; result: string }) {
  return (
    <div className="my-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
      <div className="text-xs font-medium text-blue-400">Agent completed</div>
      <p className="mt-1.5 text-sm text-[var(--text-primary)]">{result}</p>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="my-3 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-sm text-red-400">
      <span className="shrink-0 mt-0.5">!</span>
      <span className="selectable">{message}</span>
    </div>
  )
}

function TurnEndIndicator({ usage }: { usage?: { input_tokens: number; output_tokens: number } }) {
  return (
    <div className="my-6 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      {usage && <span>{(usage.input_tokens + usage.output_tokens).toLocaleString()} tokens</span>}
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  )
}
