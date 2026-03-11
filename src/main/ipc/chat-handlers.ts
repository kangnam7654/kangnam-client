import { BrowserWindow, IpcMain } from 'electron'
import { AuthManager } from '../auth/auth-manager'
import { MCPManager } from '../mcp/mcp-manager'
import { LLMRouter } from '../providers/llm-router'
import { mcpToolsToProviderTools } from '../mcp/tool-adapter'
import { ChatMessage, ToolCall } from '../providers/base-provider'
import {
  addMessage,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  updateConversationTitle
} from '../db/conversations'

const llmRouter = new LLMRouter()

// Track active abort controllers per conversation
const activeRequests = new Map<string, string>() // conversationId -> providerName

export function registerChatHandlers(
  ipcMain: IpcMain,
  authManager: AuthManager,
  mcpManager: MCPManager
): void {
  ipcMain.handle('chat:send', async (event, conversationId: string, message: string, provider: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const accessToken = authManager.getAccessToken(provider)
    if (!accessToken) {
      win.webContents.send('chat:error', { conversationId, error: `Not connected to ${provider}` })
      return
    }

    // Save user message
    addMessage(conversationId, 'user', message)

    // Get all MCP tools
    const mcpTools = mcpManager.getAllTools()
    const tools = mcpToolsToProviderTools(mcpTools)

    // Build message history
    const dbMessages = getMessages(conversationId)
    const chatMessages: ChatMessage[] = dbMessages.map(m => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
      toolUseId: m.tool_use_id ?? undefined
    }))

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
            win.webContents.send('chat:stream', { conversationId, chunk: text })
          },
          onToolCall: (toolCall) => {
            win.webContents.send('chat:tool-call', {
              conversationId,
              tool: toolCall.name,
              args: toolCall.arguments
            })
          },
          onComplete: () => {},
          onError: (error) => {
            win.webContents.send('chat:error', { conversationId, error: error.message })
          }
        }
      )

      if (result.stopReason === 'tool_use' && result.toolCalls) {
        // Save assistant response (with tool calls)
        addMessage(conversationId, 'assistant', fullResponse || '[tool call]')

        // Execute tool calls
        const toolResults = await executeToolCalls(result.toolCalls, mcpManager)

        // Add tool results to messages
        const updatedMessages: ChatMessage[] = [
          ...messages,
          { role: 'assistant', content: fullResponse || '[tool call]' },
          ...toolResults.map(tr => ({
            role: 'tool' as const,
            content: tr.content,
            toolCallId: tr.toolCallId
          }))
        ]

        // Save tool results
        for (const tr of toolResults) {
          addMessage(conversationId, 'tool', tr.content, tr.toolCallId)
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
        win.webContents.send('chat:complete', { conversationId })
      }
    }

    try {
      await runAgentLoop(chatMessages)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        win.webContents.send('chat:error', {
          conversationId,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    } finally {
      activeRequests.delete(conversationId)
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
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  mcpManager: MCPManager
): Promise<Array<{ toolCallId: string; content: string }>> {
  const results: Array<{ toolCallId: string; content: string }> = []

  for (const tc of toolCalls) {
    try {
      const result = await mcpManager.callTool(tc.name, tc.arguments)
      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text ?? '')
        .join('\n')

      results.push({
        toolCallId: tc.id,
        content: result.isError ? `Error: ${text}` : text
      })
    } catch (err) {
      results.push({
        toolCallId: tc.id,
        content: `Error executing tool ${tc.name}: ${err instanceof Error ? err.message : String(err)}`
      })
    }
  }

  return results
}
