export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolUseId?: string
  toolCallId?: string
  /** Image data URLs (base64) to include as visual input */
  images?: string[]
  /** Tool calls made by the assistant (for agent loop context) */
  toolCalls?: ToolCall[]
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface StreamCallbacks {
  onToken: (text: string) => void
  onThinking: (text: string) => void
  onToolCall: (toolCall: ToolCall) => void
  onComplete: () => void
  onError: (error: Error) => void
}

export interface LLMProvider {
  readonly name: string
  readonly displayName: string

  /**
   * Send a message and stream the response.
   * Returns when the response is complete (either end_turn or tool_use).
   */
  sendMessage(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    accessToken: string,
    callbacks: StreamCallbacks,
    model?: string,
    reasoningEffort?: 'low' | 'medium' | 'high'
  ): Promise<{ stopReason: 'end_turn' | 'tool_use'; toolCalls?: ToolCall[] }>

  /**
   * Format MCP tools for this provider's API format
   */
  formatTools(tools: ToolDefinition[]): unknown[]

  /**
   * Abort the current request
   */
  abort(): void
}
