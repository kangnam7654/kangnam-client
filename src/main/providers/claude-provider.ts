import { ChatMessage, LLMProvider, StreamCallbacks, ToolCall, ToolDefinition } from './base-provider'

type AnthropicRole = 'user' | 'assistant'

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'thinking'; thinking: string; signature?: string }

interface AnthropicMessage {
  role: AnthropicRole
  content: AnthropicContentBlock[]
}

interface PartialToolCall {
  id: string
  name: string
  inputJson: string
  emitted: boolean
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_API_VERSION = '2023-06-01'
const CLAUDE_INTERLEAVED_THINKING_BETA = 'interleaved-thinking-2025-05-14'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 16384

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  return {
    mediaType: match[1],
    data: match[2]
  }
}

function getThinkingBudget(reasoningEffort?: 'low' | 'medium' | 'high'): number | null {
  switch (reasoningEffort) {
    case 'low':
      return 2048
    case 'medium':
      return 5000
    case 'high':
      return 10000
    default:
      return null
  }
}

function isToolResultError(content: string): boolean {
  const normalized = content.trim().toLowerCase()
  return normalized.startsWith('error:') || normalized.startsWith('error executing tool ')
}

function parseSSEEvent(block: string): { event: string | null; data: string } {
  let event: string | null = null
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  return { event, data: dataLines.join('\n') }
}

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude'
  readonly displayName = 'Anthropic Claude'
  private controller: AbortController | null = null
  private lastAssistantBlocks: AnthropicContentBlock[] | null = null
  private lastAssistantToolCallIds = new Set<string>()

  formatTools(tools: ToolDefinition[]): unknown[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
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

    const systemPrompt = messages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n\n')

    const anthropicMessages = this.buildMessages(messages)
    const body: Record<string, unknown> = {
      model: model || DEFAULT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: anthropicMessages,
      stream: true
    }

    if (systemPrompt.trim()) {
      body.system = systemPrompt
    }

    if (tools.length > 0) {
      body.tools = this.formatTools(tools)
    }

    const thinkingBudget = getThinkingBudget(reasoningEffort)
    const enableThinking = thinkingBudget !== null
    if (enableThinking) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: thinkingBudget
      }
    }

    const isOAT = accessToken.startsWith('sk-ant-oat')
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': CLAUDE_API_VERSION
    }
    if (isOAT) {
      headers['Authorization'] = `Bearer ${accessToken}`
    } else {
      headers['x-api-key'] = accessToken
    }

    // Build anthropic-beta header
    const betas: string[] = []
    if (isOAT) {
      betas.push('claude-code-20250219', 'oauth-2025-04-20')
    }
    if (enableThinking && tools.length > 0) {
      betas.push(CLAUDE_INTERLEAVED_THINKING_BETA)
    }
    if (betas.length > 0) {
      headers['anthropic-beta'] = betas.join(',')
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: this.controller.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Claude] API error ${response.status}:`, errorText)
      console.error(`[Claude] Request body:`, JSON.stringify({ model: body.model, max_tokens: body.max_tokens, thinking: body.thinking, tools: (body.tools as unknown[])?.length ?? 0 }))
      throw new Error(`Claude API error ${response.status}: ${errorText}`)
    }

    return this.parseSSEStream(response, callbacks)
  }

  private buildMessages(messages: ChatMessage[]): AnthropicMessage[] {
    const anthropicMessages: AnthropicMessage[] = []
    const conversationMessages = messages.filter(message => message.role !== 'system')
    let pendingToolResults: AnthropicContentBlock[] = []
    let awaitingToolResults = false

    for (const message of conversationMessages) {
      switch (message.role) {
        case 'assistant': {
          if (pendingToolResults.length > 0) {
            anthropicMessages.push({ role: 'user', content: pendingToolResults })
            pendingToolResults = []
            awaitingToolResults = false
          }

          const assistantBlocks = this.buildAssistantBlocks(message)
          if (assistantBlocks.length > 0) {
            anthropicMessages.push({ role: 'assistant', content: assistantBlocks })
            awaitingToolResults = assistantBlocks.some(block => block.type === 'tool_use')
          }
          break
        }

        case 'tool': {
          if (!awaitingToolResults || !message.toolCallId) {
            break
          }

          pendingToolResults.push({
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content,
            is_error: isToolResultError(message.content) || undefined
          })
          break
        }

        case 'user': {
          const userBlocks: AnthropicContentBlock[] = [...pendingToolResults]
          pendingToolResults = []
          awaitingToolResults = false

          if (message.images && message.images.length > 0) {
            for (const image of message.images) {
              const parsed = parseDataUrl(image)
              if (!parsed) continue
              userBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: parsed.mediaType,
                  data: parsed.data
                }
              })
            }
          }

          if (message.content) {
            userBlocks.push({ type: 'text', text: message.content })
          }

          if (userBlocks.length > 0) {
            anthropicMessages.push({ role: 'user', content: userBlocks })
          }
          break
        }
      }
    }

    if (pendingToolResults.length > 0) {
      anthropicMessages.push({ role: 'user', content: pendingToolResults })
    }

    return anthropicMessages
  }

  private buildAssistantBlocks(message: ChatMessage): AnthropicContentBlock[] {
    if (message.toolCalls && this.matchesLastAssistantToolCalls(message.toolCalls)) {
      return this.lastAssistantBlocks ? [...this.lastAssistantBlocks] : []
    }

    const blocks: AnthropicContentBlock[] = []

    if (message.content && message.content !== '[tool call]') {
      blocks.push({ type: 'text', text: message.content })
    }

    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.arguments
        })
      }
    }

    return blocks
  }

  private matchesLastAssistantToolCalls(toolCalls: ToolCall[]): boolean {
    if (!this.lastAssistantBlocks || toolCalls.length === 0) {
      return false
    }

    if (toolCalls.length !== this.lastAssistantToolCallIds.size) {
      return false
    }

    return toolCalls.every(toolCall => this.lastAssistantToolCallIds.has(toolCall.id))
  }

  private async parseSSEStream(
    response: Response,
    callbacks: StreamCallbacks
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    const toolCalls: ToolCall[] = []
    const partialToolCalls = new Map<number, PartialToolCall>()
    const assistantBlocks = new Map<number, AnthropicContentBlock>()
    let stopReason: 'end_turn' | 'tool_use' = 'end_turn'
    let buffer = ''

    const finalizeToolCall = (index: number): void => {
      const partial = partialToolCalls.get(index)
      if (!partial || partial.emitted) return

      let input: Record<string, unknown> = {}
      if (partial.inputJson.trim()) {
        try {
          input = JSON.parse(partial.inputJson) as Record<string, unknown>
        } catch {
          input = {}
        }
      }

      const toolCall: ToolCall = {
        id: partial.id,
        name: partial.name,
        arguments: input
      }

      partial.emitted = true
      assistantBlocks.set(index, {
        type: 'tool_use',
        id: partial.id,
        name: partial.name,
        input
      })
      toolCalls.push(toolCall)
      callbacks.onToolCall(toolCall)
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const rawEvent of events) {
          const trimmed = rawEvent.trim()
          if (!trimmed) continue

          const { event, data } = parseSSEEvent(trimmed)
          if (!data || data === '[DONE]') continue

          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(data) as Record<string, unknown>
          } catch {
            continue
          }

          const eventType = event ?? String(parsed.type ?? '')
          if (eventType === 'ping' || eventType === 'message_start') {
            continue
          }

          if (eventType === 'error') {
            const error = parsed.error as { message?: string } | undefined
            throw new Error(error?.message || 'Claude streaming error')
          }

          if (eventType === 'content_block_start') {
            const index = Number(parsed.index ?? -1)
            const contentBlock = parsed.content_block as Record<string, unknown> | undefined
            if (!contentBlock || index < 0) continue

            const blockType = String(contentBlock.type ?? '')
            if (blockType === 'text') {
              assistantBlocks.set(index, {
                type: 'text',
                text: String(contentBlock.text ?? '')
              })
            } else if (blockType === 'thinking') {
              assistantBlocks.set(index, {
                type: 'thinking',
                thinking: String(contentBlock.thinking ?? '')
              })
            } else if (blockType === 'tool_use') {
              const initialInput = contentBlock.input && typeof contentBlock.input === 'object'
                ? contentBlock.input as Record<string, unknown>
                : null
              partialToolCalls.set(index, {
                id: String(contentBlock.id ?? ''),
                name: String(contentBlock.name ?? ''),
                inputJson: initialInput && Object.keys(initialInput).length > 0
                  ? JSON.stringify(initialInput)
                  : '',
                emitted: false
              })
              assistantBlocks.set(index, {
                type: 'tool_use',
                id: String(contentBlock.id ?? ''),
                name: String(contentBlock.name ?? ''),
                input: initialInput ?? {}
              })
            }
            continue
          }

          if (eventType === 'content_block_delta') {
            const index = Number(parsed.index ?? -1)
            const delta = parsed.delta as Record<string, unknown> | undefined
            if (!delta || index < 0) continue

            const deltaType = String(delta.type ?? '')
            if (deltaType === 'text_delta') {
              const block = assistantBlocks.get(index)
              if (block?.type === 'text') {
                block.text += String(delta.text ?? '')
                callbacks.onToken(String(delta.text ?? ''))
              }
              continue
            }

            if (deltaType === 'thinking_delta') {
              const block = assistantBlocks.get(index)
              if (block?.type === 'thinking') {
                const thinkingText = String(delta.thinking ?? '')
                block.thinking += thinkingText
                callbacks.onThinking(thinkingText)
              }
              continue
            }

            if (deltaType === 'signature_delta') {
              const block = assistantBlocks.get(index)
              if (block?.type === 'thinking') {
                block.signature = String(delta.signature ?? '')
              }
              continue
            }

            if (deltaType === 'input_json_delta') {
              const partial = partialToolCalls.get(index)
              if (partial) {
                partial.inputJson += String(delta.partial_json ?? '')
              }
            }
            continue
          }

          if (eventType === 'content_block_stop') {
            const index = Number(parsed.index ?? -1)
            if (index >= 0) {
              finalizeToolCall(index)
            }
            continue
          }

          if (eventType === 'message_delta') {
            const delta = parsed.delta as { stop_reason?: string } | undefined
            if (delta?.stop_reason === 'tool_use') {
              stopReason = 'tool_use'
            }
            continue
          }

          if (eventType === 'message_stop') {
            continue
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    for (const index of partialToolCalls.keys()) {
      finalizeToolCall(index)
    }

    if (toolCalls.length > 0) {
      stopReason = 'tool_use'
    }

    this.lastAssistantBlocks = [...assistantBlocks.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, block]) => block)
    this.lastAssistantToolCallIds = new Set(toolCalls.map(toolCall => toolCall.id))

    callbacks.onComplete()
    return {
      stopReason,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }

  abort(): void {
    this.controller?.abort()
    this.controller = null
  }
}
