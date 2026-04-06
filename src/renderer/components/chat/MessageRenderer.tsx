import type { UnifiedMessage } from '../../stores/app-store'

interface MessageRendererProps {
  message: UnifiedMessage
}

export function MessageRenderer({ message }: MessageRendererProps) {
  switch (message.type) {
    case 'text_delta':
      return <TextMessage text={message.text} />
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

function TextMessage({ text }: { text: string }) {
  return <span className="whitespace-pre-wrap">{text}</span>
}

function ToolUseCard({ id: _id, name, input }: { id: string; name: string; input: unknown }) {
  return (
    <div className="my-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
        {name}
      </div>
      <pre className="mt-2 overflow-x-auto text-xs text-[var(--text-tertiary)]">
        {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
      </pre>
    </div>
  )
}

function ToolResultCard({ id: _id, output, isError }: { id: string; output: string; isError: boolean }) {
  return (
    <div className={`my-2 rounded-lg border p-3 text-xs font-mono ${
      isError
        ? 'border-red-500/30 bg-red-500/5 text-red-400'
        : 'border-green-500/30 bg-green-500/5 text-green-400'
    }`}>
      <pre className="overflow-x-auto whitespace-pre-wrap">{output}</pre>
    </div>
  )
}

function AgentStartCard({ id: _id, name, description }: { id: string; name: string; description: string }) {
  return (
    <div className="my-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
        Agent: {name}
      </div>
      {description && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{description}</p>}
    </div>
  )
}

function AgentProgressCard({ id: _id, message }: { id: string; message: string }) {
  return (
    <div className="ml-4 border-l-2 border-blue-500/30 pl-3 text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  )
}

function AgentEndCard({ id: _id, result }: { id: string; result: string }) {
  return (
    <div className="my-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="text-xs font-medium text-blue-400">Agent completed</div>
      <p className="mt-1 text-sm text-[var(--text-primary)]">{result}</p>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="my-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
      {message}
    </div>
  )
}

function TurnEndIndicator({ usage }: { usage?: { input_tokens: number; output_tokens: number } }) {
  if (!usage) return <div className="my-2 h-px bg-[var(--border-subtle)]" />
  return (
    <div className="my-2 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      <span>{usage.input_tokens + usage.output_tokens} tokens</span>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
  )
}
