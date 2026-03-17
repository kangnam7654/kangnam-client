import { BrowserWindow, IpcMain } from 'electron'
import { AuthManager } from '../auth/auth-manager'
import { MCPManager } from '../mcp/mcp-manager'
import { LLMRouter } from '../providers/llm-router'
import { mcpToolsToProviderTools } from '../mcp/tool-adapter'
import { ChatMessage, ToolCall } from '../providers/base-provider'
import { getDb } from '../db/database'
import {
  addMessage,
  autoTitleIfNeeded,
  createConversation,
  deleteConversation,
  deleteAllConversations,
  getConversation,
  getMessages,
  listConversations,
  updateConversationTitle,
  togglePin,
  searchMessages
} from '../db/conversations'

const llmRouter = new LLMRouter()

/** Safely send IPC message — no-op if window is destroyed */
function safeSend(win: BrowserWindow, channel: string, data: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

// Track active abort controllers per conversation
const activeRequests = new Map<string, string>() // conversationId -> providerName

export function registerChatHandlers(
  ipcMain: IpcMain,
  authManager: AuthManager,
  mcpManager: MCPManager
): void {
  ipcMain.handle('chat:send', async (event, conversationId: string, message: string, provider: string, attachments?: string, model?: string, reasoningEffort?: string, promptId?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const isMock = provider === 'mock'
    const accessToken = isMock ? 'mock-token' : await authManager.getAccessToken(provider)
    if (!accessToken) {
      safeSend(win, 'chat:error', { conversationId, error: `Not connected to ${provider}` })
      return
    }

    // Inject skill instructions (+ references) BEFORE user message
    if (promptId) {
      const { getSkillInstructions } = require('../db/skills')
      const instructions: string | null = getSkillInstructions(promptId)
      if (instructions) {
        addMessage(conversationId, 'system', instructions)
      }
    }

    // Save user message (with attachments if any)
    addMessage(conversationId, 'user', message, undefined, undefined, attachments || undefined)

    // Auto-generate title from first user message
    autoTitleIfNeeded(conversationId, message)

    // Get all MCP tools
    const mcpTools = mcpManager.getAllTools()
    const tools = mcpToolsToProviderTools(mcpTools)

    // Build message history (include image attachments for multimodal)
    const dbMessages = getMessages(conversationId)
    const chatMessages: ChatMessage[] = dbMessages.map(m => {
      const msg: ChatMessage = {
        role: m.role as ChatMessage['role'],
        content: m.content,
        toolUseId: m.tool_use_id ?? undefined
      }
      if (m.attachments) {
        try {
          const atts = JSON.parse(m.attachments) as Array<{ type: string; dataUrl: string }>
          const imgs = atts.filter(a => a.type === 'image').map(a => a.dataUrl)
          if (imgs.length > 0) msg.images = imgs
        } catch { /* ignore */ }
      }
      return msg
    })

    // ── Context window management ──
    const contextWindow = getContextWindowForModel(provider, model)
    let totalTokens = chatMessages.reduce((sum, m) => sum + estimateTokenCount(m.content), 0)

    // Send context usage to renderer
    safeSend(win, 'chat:context-usage', { conversationId, used: totalTokens, max: contextWindow })

    // Compact if over 90%
    if (totalTokens > contextWindow * 0.9 && chatMessages.length > 6) {
      try {
        const compacted = await compactConversation(chatMessages, provider, accessToken, model)
        chatMessages.length = 0
        chatMessages.push(...compacted)
        totalTokens = chatMessages.reduce((sum, m) => sum + estimateTokenCount(m.content), 0)
        safeSend(win, 'chat:context-usage', { conversationId, used: totalTokens, max: contextWindow })
      } catch (err) {
        console.error('[Context] Compaction failed:', err)
        // Fall through — send as-is, may hit API limit
      }
    }

    const llmProvider = llmRouter.getProvider(provider)
    activeRequests.set(conversationId, provider)

    let fullResponse = ''

    // Agent loop: handle tool calls
    const runAgentLoop = async (messages: ChatMessage[]): Promise<void> => {
      const result = await llmProvider.sendMessage(
        messages,
        tools,
        accessToken,
        {

          onToken: (text) => {
            fullResponse += text
            safeSend(win, 'chat:stream', { conversationId, chunk: text })
          },
          onThinking: (text) => {
            safeSend(win, 'chat:thinking', { conversationId, chunk: text })
          },
          onToolCall: (toolCall) => {
            safeSend(win, 'chat:tool-call', {
              conversationId,
              tool: toolCall.name,
              args: toolCall.arguments
            })
          },
          onComplete: () => {},
          onError: (error) => {
            safeSend(win, 'chat:error', { conversationId, error: error.message })
          }
        },
        model || undefined,
        (reasoningEffort as 'low' | 'medium' | 'high') || undefined
      )

      if (result.stopReason === 'tool_use' && result.toolCalls) {
        // Save assistant response (with tool calls)
        addMessage(conversationId, 'assistant', fullResponse || '[tool call]')

        // Execute tool calls
        const toolResults = await executeToolCalls(result.toolCalls, mcpManager)

        // Add tool results to messages (include toolCalls on assistant message for API context)
        const updatedMessages: ChatMessage[] = [
          ...messages,
          { role: 'assistant', content: fullResponse || '[tool call]', toolCalls: result.toolCalls },
          ...toolResults.map(tr => ({
            role: 'tool' as const,
            content: tr.content,
            toolCallId: tr.toolCallId
          }))
        ]

        // Save tool results (with tool name and args)
        for (const tr of toolResults) {
          addMessage(conversationId, 'tool', tr.content, tr.toolCallId, undefined, undefined, tr.toolName, JSON.stringify(tr.toolArgs))
        }

        // Reset for next iteration
        fullResponse = ''

        // Continue the loop
        await runAgentLoop(updatedMessages)
      } else {
        // Save final assistant response
        if (fullResponse) {
          addMessage(conversationId, 'assistant', fullResponse)
        }
        safeSend(win, 'chat:complete', { conversationId })
      }
    }

    try {
      await runAgentLoop(chatMessages)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Save partial response accumulated before abort
        if (fullResponse.trim()) {
          addMessage(conversationId, 'assistant', fullResponse)
        }
        safeSend(win, 'chat:complete', { conversationId })
      } else {
        safeSend(win, 'chat:error', {
          conversationId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    } finally {
      activeRequests.delete(conversationId)
    }

    // Fire-and-forget: generate smart title via LLM after first exchange
    const userMsgCount = getMessages(conversationId).filter(m => m.role === 'user').length
    if (userMsgCount === 1) {
      generateSmartTitle(provider, accessToken, message, model || undefined)
        .then(smartTitle => {
          if (smartTitle) {
            updateConversationTitle(conversationId, smartTitle)
            safeSend(win, 'conv:title-updated', { conversationId, title: smartTitle })
          }
        })
        .catch(() => {}) // swallow — fallback title from autoTitleIfNeeded is already set
    }
  })

  ipcMain.handle('chat:stop', (_event, conversationId: string) => {
    const provider = activeRequests.get(conversationId)
    if (provider) {
      llmRouter.abort(provider)
      activeRequests.delete(conversationId)
    }
  })

  // Conversation CRUD
  ipcMain.handle('conv:list', () => listConversations())
  ipcMain.handle('conv:create', (_event, provider: string) => createConversation(provider))
  ipcMain.handle('conv:delete', (_event, id: string) => deleteConversation(id))
  ipcMain.handle('conv:get-messages', (_event, id: string) => getMessages(id))
  ipcMain.handle('conv:update-title', (_event, id: string, title: string) => updateConversationTitle(id, title))
  ipcMain.handle('conv:toggle-pin', (_event, id: string) => togglePin(id))
  ipcMain.handle('conv:delete-all', () => deleteAllConversations())
  ipcMain.handle('conv:search', (_event, query: string) => searchMessages(query))
}

/**
 * Generate a smart conversation title using LLM.
 * Creates a fresh provider instance to avoid conflicts with the main chat flow.
 */
async function generateSmartTitle(
  providerName: string,
  accessToken: string,
  userMessage: string,
  model?: string
): Promise<string | null> {
  // Create an isolated provider instance (separate AbortController)
  const freshProvider = llmRouter.createFresh(providerName)
  if (!freshProvider) return null

  let title = ''
  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Generate a concise conversation title (3-8 words) based on the user\'s message. No quotes, no period, no prefix. Reply with ONLY the title, nothing else.'
      },
      { role: 'user', content: userMessage }
    ]

    await freshProvider.sendMessage(messages, [], accessToken, {
      onToken: (t) => { title += t },
      onToolCall: () => {},
      onComplete: () => {},
      onError: () => {}
    }, model)

    const cleaned = title
      .trim()
      .replace(/^["']+|["']+$/g, '')  // strip wrapping quotes
      .replace(/[.!]+$/, '')           // strip trailing punctuation
      .trim()

    return (cleaned.length > 0 && cleaned.length <= 80) ? cleaned : null
  } catch {
    return null
  }
}

interface ToolResult {
  toolCallId: string
  toolName: string
  toolArgs: Record<string, unknown>
  content: string
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  mcpManager: MCPManager
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  for (const tc of toolCalls) {
    try {
      const result = await mcpManager.callTool(tc.name, tc.arguments)
      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text ?? '')
        .join('\n')

      results.push({
        toolCallId: tc.id,
        toolName: tc.name,
        toolArgs: tc.arguments ?? {},
        content: result.isError ? `Error: ${text}` : text
      })
    } catch (err) {
      results.push({
        toolCallId: tc.id,
        toolName: tc.name,
        toolArgs: tc.arguments ?? {},
        content: `Error executing tool ${tc.name}: ${err instanceof Error ? err.message : String(err)}`
      })
    }
  }

  return results
}

// ── Context Window Helpers ──

function estimateTokenCount(text: string): number {
  if (!text) return 0
  const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length
  const totalChars = text.length
  const koreanRatio = totalChars > 0 ? koreanChars / totalChars : 0
  const charsPerToken = 4 - (koreanRatio * 2.5)
  return Math.ceil(totalChars / charsPerToken)
}

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-6': 200000, 'claude-sonnet-4-6': 200000, 'claude-haiku-4-5': 200000,
  'gpt-5.4': 128000, 'gpt-5.3-codex': 128000, 'gpt-5.2': 128000, 'gpt-4.1': 128000,
  'gemini-3.1-pro-preview': 1000000, 'gemini-3-flash-preview': 1000000
}

function getContextWindowForModel(_provider: string, model?: string): number {
  if (!model) return 128000
  // Try exact match, then prefix match
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model]
  for (const [key, val] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (model.startsWith(key)) return val
  }
  return 128000
}

const COMPACTION_SYSTEM = `Summarize this conversation concisely. Preserve:
- Key decisions and conclusions
- User preferences and constraints
- Technical context (file paths, variable names, APIs, etc.)
- Unresolved questions or pending tasks

Keep the summary under 500 tokens. Use the same language as the conversation.
Output ONLY the summary, no preamble.`

async function compactConversation(
  messages: ChatMessage[],
  provider: string,
  accessToken: string,
  model?: string
): Promise<ChatMessage[]> {
  const { callLLM } = require('../skills/skill-ai')

  const systemMsgs = messages.filter(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  // Keep last 6 messages (3 turns)
  const keep = nonSystem.slice(-6)
  const toSummarize = nonSystem.slice(0, -6)

  if (toSummarize.length < 4) return messages

  const transcript = toSummarize
    .map(m => `[${m.role}]: ${m.content.slice(0, 2000)}`)
    .join('\n\n')

  const summary = await callLLM(provider, accessToken, [
    { role: 'system', content: COMPACTION_SYSTEM },
    { role: 'user', content: transcript }
  ], model)

  return [
    ...systemMsgs,
    { role: 'system' as const, content: `<conversation_summary>\n${summary.trim()}\n</conversation_summary>` },
    ...keep
  ]
}
