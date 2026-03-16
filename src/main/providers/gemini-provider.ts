import { ChatMessage, LLMProvider, StreamCallbacks, ToolCall, ToolDefinition } from './base-provider'

/**
 * Gemini provider using the Code Assist endpoint (subscription-based).
 * Uses cloudcode-pa.googleapis.com/v1internal with a non-standard request envelope.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini'
  readonly displayName = 'Google Gemini'
  private controller: AbortController | null = null

  formatTools(tools: ToolDefinition[]): unknown[] {
    return [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }))
    }]
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

    // Convert to Gemini format (with multimodal support)
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const parts: Array<Record<string, unknown>> = []
        // Add inline image data
        if (m.images && m.images.length > 0) {
          for (const img of m.images) {
            const match = img.match(/^data:([^;]+);base64,(.+)$/)
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
            }
          }
        }
        parts.push({ text: m.content })
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts
        }
      })

    const systemInstruction = messages.find(m => m.role === 'system')

    // Build the inner request (standard GenerateContent format)
    const innerRequest: Record<string, unknown> = { contents }

    if (systemInstruction) {
      innerRequest.systemInstruction = { parts: [{ text: systemInstruction.content }] }
    }

    if (tools.length > 0) {
      innerRequest.tools = this.formatTools(tools)
    }

    if (reasoningEffort) {
      innerRequest.generationConfig = {
        thinkingConfig: { thinkingLevel: reasoningEffort }
      }
    }

    // Code Assist uses a wrapping envelope
    const body = {
      model: model || 'gemini-3.1-pro-preview',
      request: innerRequest
    }

    const response = await fetch(
      'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
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
      throw new Error(`Gemini API error ${response.status}: ${errorText}`)
    }

    return this.parseSSEStream(response, callbacks)
  }

  private async parseSSEStream(
    response: Response,
    callbacks: StreamCallbacks
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }> {
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
              candidates?: Array<{
                content: {
                  parts: Array<{
                    text?: string
                    functionCall?: { name: string; args: Record<string, unknown> }
                  }>
                }
                finishReason?: string
              }>
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
                  id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
}
