import { ChatMessage, LLMProvider, StreamCallbacks, ToolCall, ToolDefinition } from './base-provider'
import { appendFileSync } from 'fs'

export const CODEX_MODELS = [
  { id: 'gpt-5.4', label: 'GPT-5.4', description: 'Latest flagship' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', description: 'Coding optimized' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', description: 'Coding optimized' },
  { id: 'gpt-5.2', label: 'GPT-5.2', description: 'General purpose' },
  { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', description: 'Coding optimized' },
  { id: 'gpt-5.1', label: 'GPT-5.1', description: 'General purpose' },
  { id: 'gpt-5-codex', label: 'GPT-5 Codex', description: 'Legacy coding' },
  { id: 'gpt-5', label: 'GPT-5', description: 'Legacy general' }
]

export class CodexProvider implements LLMProvider {
  readonly name = 'codex'
  readonly displayName = 'OpenAI Codex'
  private controller: AbortController | null = null

  formatTools(tools: ToolDefinition[]): unknown[] {
    return tools.map(t => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }))
  }

  async sendMessage(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    accessToken: string,
    callbacks: StreamCallbacks,
    model?: string,
    reasoningEffort?: 'low' | 'medium' | 'high'
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }> {
    this.controller = new AbortController()

    // Separate system instructions from conversation messages
    const systemMsgs = messages.filter(m => m.role === 'system')
    const conversationMsgs = messages.filter(m => m.role !== 'system')

    // Build Responses API input format
    // Skip tool messages from DB that lack matching function_call context
    const input: Record<string, unknown>[] = []
    for (const m of conversationMsgs) {
      if (m.role === 'tool') {
        // Only include tool results if we have the matching function_call (from current agent loop)
        const callId = m.toolCallId ?? m.toolUseId ?? ''
        if (callId) {
          input.push({
            type: 'function_call_output',
            call_id: callId,
            output: m.content
          })
        }
        // Skip tool messages without call_id (orphaned from DB)
      } else if (m.role === 'assistant' && m.content === '[tool call]' && !m.toolCalls) {
        // Skip placeholder assistant messages from DB (no function_call info to reconstruct)
        continue
      } else if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        // Current session: assistant message with tool calls — emit function_call items
        if (m.content && m.content !== '[tool call]') {
          input.push({ role: 'assistant', content: m.content })
        }
        for (const tc of m.toolCalls) {
          input.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          })
        }
      } else if (m.images && m.images.length > 0) {
        const parts: Array<Record<string, unknown>> = []
        for (const img of m.images) {
          parts.push({ type: 'input_image', image_url: img })
        }
        if (m.content) {
          parts.push({ type: 'input_text', text: m.content })
        }
        input.push({ role: m.role as 'user' | 'assistant', content: parts })
      } else {
        input.push({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })
      }
    }

    // Remove orphaned function_call_output items that lack a matching function_call
    const functionCallIds = new Set(
      input.filter(i => i.type === 'function_call').map(i => i.call_id as string)
    )
    const cleanedInput = input.filter(i => {
      if (i.type === 'function_call_output') {
        return functionCallIds.has(i.call_id as string)
      }
      return true
    })

    // Debug: log input
    try {
      appendFileSync('/tmp/codex-debug.log', `[${new Date().toISOString()}] Input:\n${JSON.stringify(cleanedInput, null, 2)}\n---\n`)
    } catch { /* ignore */ }

    const body: Record<string, unknown> = {
      model: model || 'gpt-5.4',
      instructions: systemMsgs.length > 0
        ? systemMsgs.map(m => m.content).join('\n')
        : 'You are a helpful assistant.',
      input: cleanedInput,
      stream: true,
      store: false
    }

    if (tools.length > 0) {
      body.tools = this.formatTools(tools)
    }

    if (reasoningEffort) {
      body.reasoning = { effort: reasoningEffort }
    }

    const response = await fetch('https://chatgpt.com/backend-api/codex/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body),
      signal: this.controller.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Codex API error ${response.status}: ${errorText}`)
    }

    const toolCalls: ToolCall[] = []
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let stopReason: 'end_turn' | 'tool_use' = 'end_turn'

    // Track partial tool calls
    const partialToolCalls = new Map<string, { id: string; name: string; args: string }>()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            // Responses API streaming format
            const type = parsed.type as string

            if (type === 'response.output_text.delta') {
              // Text delta
              callbacks.onToken(parsed.delta ?? '')
            } else if (type === 'response.function_call_arguments.delta') {
              // Tool call argument streaming
              const callId = parsed.item_id ?? parsed.call_id ?? ''
              if (!partialToolCalls.has(callId)) {
                partialToolCalls.set(callId, { id: callId, name: parsed.name ?? '', args: '' })
              }
              const partial = partialToolCalls.get(callId)!
              if (parsed.name) partial.name = parsed.name
              partial.args += parsed.delta ?? ''
            } else if (type === 'response.function_call_arguments.done') {
              // Tool call complete
              const callId = parsed.item_id ?? parsed.call_id ?? ''
              if (!partialToolCalls.has(callId)) {
                partialToolCalls.set(callId, { id: callId, name: parsed.name ?? '', args: parsed.arguments ?? '' })
              } else {
                const partial = partialToolCalls.get(callId)!
                if (parsed.name) partial.name = parsed.name
                if (parsed.arguments) partial.args = parsed.arguments
              }
            } else if (type === 'response.output_item.added') {
              // New output item - could be function call
              // Use item.id as map key (matches item_id in delta events)
              // Store item.call_id as the actual ID for API responses
              if (parsed.item?.type === 'function_call') {
                const itemId = parsed.item.id ?? parsed.item.call_id ?? ''
                partialToolCalls.set(itemId, {
                  id: parsed.item.call_id ?? itemId,
                  name: parsed.item.name ?? '',
                  args: ''
                })
              }
            } else if (type === 'response.completed' || type === 'response.done') {
              // Check stop reason
              const resp = parsed.response ?? parsed
              if (resp.status === 'incomplete' || resp.output?.some?.((o: any) => o.type === 'function_call')) {
                stopReason = 'tool_use'
              }
            }

            // Also handle Chat Completions format as fallback
            if (parsed.choices) {
              const choice = parsed.choices[0]
              if (choice?.delta?.content) {
                callbacks.onToken(choice.delta.content)
              }
              if (choice?.delta?.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const key = `idx_${tc.index}`
                  if (!partialToolCalls.has(key)) {
                    partialToolCalls.set(key, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' })
                  }
                  const partial = partialToolCalls.get(key)!
                  if (tc.id) partial.id = tc.id
                  if (tc.function?.name) partial.name = tc.function.name
                  if (tc.function?.arguments) partial.args += tc.function.arguments
                }
              }
              if (choice?.finish_reason === 'tool_calls') {
                stopReason = 'tool_use'
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Finalize tool calls
    for (const [, partial] of partialToolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(partial.args)
      } catch {
        // empty
      }
      const tc: ToolCall = { id: partial.id, name: partial.name, arguments: args }
      toolCalls.push(tc)
      callbacks.onToolCall(tc)
    }

    if (toolCalls.length > 0) {
      stopReason = 'tool_use'
    }

    callbacks.onComplete()
    return { stopReason, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
  }

  abort(): void {
    this.controller?.abort()
    this.controller = null
  }
}
