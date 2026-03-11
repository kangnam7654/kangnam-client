import { ChatMessage, LLMProvider, StreamCallbacks, ToolCall, ToolDefinition } from './base-provider'

/**
 * GitHub Copilot provider.
 * Uses VSCode-compatible headers to access Copilot's chat completions API.
 * Copilot token has 30-min TTL and must be refreshed via the GitHub OAuth token.
 */
export class CopilotProvider implements LLMProvider {
  readonly name = 'copilot'
  readonly displayName = 'GitHub Copilot'
  private controller: AbortController | null = null

  formatTools(tools: ToolDefinition[]): unknown[] {
    // Copilot uses OpenAI-compatible format
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }
    }))
  }

  async sendMessage(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    accessToken: string,
    callbacks: StreamCallbacks
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }> {
    this.controller = new AbortController()

    const formattedMessages = messages.map(m => ({
      role: m.role === 'tool' ? 'tool' : m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {})
    }))

    const body: Record<string, unknown> = {
      model: 'gpt-4o',
      messages: formattedMessages,
      stream: true
    }

    if (tools.length > 0) {
      body.tools = this.formatTools(tools)
    }

    const response = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        // Required headers to simulate VSCode
        'Editor-Version': 'vscode/1.97.0',
        'Editor-Plugin-Version': 'copilot-chat/0.22.0',
        'Openai-Organization': 'github-copilot',
        'Copilot-Integration-Id': 'vscode-chat',
        'X-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(body),
      signal: this.controller.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Copilot API error ${response.status}: ${errorText}`)
    }

    const toolCalls: ToolCall[] = []
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let stopReason: 'end_turn' | 'tool_use' = 'end_turn'
    const partialToolCalls = new Map<number, { id: string; name: string; args: string }>()

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
            const parsed = JSON.parse(data) as {
              choices: Array<{
                delta: {
                  content?: string
                  tool_calls?: Array<{
                    index: number
                    id?: string
                    function?: { name?: string; arguments?: string }
                  }>
                }
                finish_reason?: string
              }>
            }

            const choice = parsed.choices[0]
            if (!choice) continue

            if (choice.delta.content) {
              callbacks.onToken(choice.delta.content)
            }

            if (choice.delta.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                if (!partialToolCalls.has(tc.index)) {
                  partialToolCalls.set(tc.index, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' })
                }
                const partial = partialToolCalls.get(tc.index)!
                if (tc.id) partial.id = tc.id
                if (tc.function?.name) partial.name = tc.function.name
                if (tc.function?.arguments) partial.args += tc.function.arguments
              }
            }

            if (choice.finish_reason === 'tool_calls') {
              stopReason = 'tool_use'
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    for (const [, partial] of partialToolCalls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(partial.args) } catch { /* empty */ }
      const tc: ToolCall = { id: partial.id, name: partial.name, arguments: args }
      toolCalls.push(tc)
      callbacks.onToolCall(tc)
    }

    if (toolCalls.length > 0) stopReason = 'tool_use'

    callbacks.onComplete()
    return { stopReason, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
  }

  abort(): void {
    this.controller?.abort()
    this.controller = null
  }
}
