import { ChatMessage, LLMProvider, StreamCallbacks, ToolCall, ToolDefinition } from './base-provider'

/**
 * Antigravity provider uses Google's Interactions API.
 * State is managed server-side; subsequent requests pass previousInteractionId.
 * Falls back to Gemini CLI quota when Antigravity quota is exhausted.
 */
export class AntigravityProvider implements LLMProvider {
  readonly name = 'antigravity'
  readonly displayName = 'Google Antigravity'
  private controller: AbortController | null = null
  private interactionId: string | null = null

  formatTools(tools: ToolDefinition[]): unknown[] {
    // Antigravity uses Gemini-compatible function declarations
    return [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: this.enrichDescription(t),
        parameters: t.inputSchema
      }))
    }]
  }

  /**
   * Embed JSON Schema constraints in description for Gemini compatibility.
   * Gemini silently ignores format, pattern, minLength etc.
   */
  private enrichDescription(tool: ToolDefinition): string {
    let desc = tool.description
    const schema = tool.inputSchema as { properties?: Record<string, { format?: string; pattern?: string }> }
    if (schema.properties) {
      const constraints: string[] = []
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.format) constraints.push(`${key}: format=${prop.format}`)
        if (prop.pattern) constraints.push(`${key}: pattern=${prop.pattern}`)
      }
      if (constraints.length > 0) {
        desc += ` [Constraints: ${constraints.join('; ')}]`
      }
    }
    return desc
  }

  async sendMessage(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    accessToken: string,
    callbacks: StreamCallbacks
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }> {
    this.controller = new AbortController()

    // Build Interactions API request
    const userMessage = messages[messages.length - 1]?.content ?? ''

    const body: Record<string, unknown> = {
      userInput: { text: userMessage },
      config: {
        model: 'gemini-2.5-pro',
        thinkingConfig: { thinkingBudget: 1024 }
      }
    }

    if (this.interactionId) {
      body.previousInteractionId = this.interactionId
    }

    if (tools.length > 0) {
      body.tools = this.formatTools(tools)
    }

    // Antigravity uses the Interactions API endpoint
    const response = await fetch(
      'https://autopush-aiplatform.sandbox.googleapis.com/v1/projects/-/locations/-/interactions:streamGenerate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(body),
        signal: this.controller.signal
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Antigravity API error ${response.status}: ${errorText}`)
    }

    const toolCalls: ToolCall[] = []
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let stopReason: 'end_turn' | 'tool_use' = 'end_turn'

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
          if (!data) continue

          try {
            const parsed = JSON.parse(data) as {
              interactionId?: string
              candidates?: Array<{
                content: {
                  parts: Array<{
                    text?: string
                    functionCall?: { name: string; args: Record<string, unknown> }
                  }>
                }
              }>
            }

            // Track interaction ID for stateful conversations
            if (parsed.interactionId) {
              this.interactionId = parsed.interactionId
            }

            const candidate = parsed.candidates?.[0]
            if (!candidate) continue

            for (const part of candidate.content.parts) {
              if (part.text) {
                callbacks.onToken(part.text)
              }
              if (part.functionCall) {
                stopReason = 'tool_use'
                const tc: ToolCall = {
                  id: `antigravity_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args
                }
                toolCalls.push(tc)
                callbacks.onToolCall(tc)
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    callbacks.onComplete()
    return { stopReason, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
  }

  abort(): void {
    this.controller?.abort()
    this.controller = null
  }

  /** Reset interaction state for new conversation */
  resetInteraction(): void {
    this.interactionId = null
  }
}
