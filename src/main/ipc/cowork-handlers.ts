import { BrowserWindow, IpcMain } from 'electron'
import { AuthManager } from '../auth/auth-manager'
import { MCPManager } from '../mcp/mcp-manager'
import { LLMRouter } from '../providers/llm-router'
import { mcpToolsToProviderTools } from '../mcp/tool-adapter'
import { ChatMessage, ToolCall } from '../providers/base-provider'

const llmRouter = new LLMRouter()

const COWORK_SYSTEM_PROMPT = `You are an autonomous task executor. When given a task:
1. First, output a plan as a numbered list. Each step must be on its own line prefixed with "PLAN:" (e.g., "PLAN: 1. Analyze the codebase")
2. Then execute each step using available tools
3. Before starting each step, output "STEP_START: N" where N is the step number
4. After completing each step, output "STEP_COMPLETE: N"
5. When all done, output "TASK_COMPLETE" followed by a summary

Be methodical and thorough. Execute each step fully before moving to the next.
If a step requires multiple tool calls, make them all before marking the step complete.`

// Track active cowork session
let activeController: AbortController | null = null
let coworkMessages: ChatMessage[] = []

/** Safely send IPC message — no-op if window is destroyed */
function safeSend(win: BrowserWindow, channel: string, data: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

export function registerCoworkHandlers(
  ipcMain: IpcMain,
  authManager: AuthManager,
  mcpManager: MCPManager
): void {
  ipcMain.handle('cowork:start', async (event, task: string, provider: string, model?: string, reasoningEffort?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const accessToken = await authManager.getAccessToken(provider)
    if (!accessToken) {
      safeSend(win, 'cowork:error', { error: `Not connected to ${provider}` })
      return
    }

    // Abort any existing session
    if (activeController) {
      activeController.abort()
    }
    activeController = new AbortController()

    const mcpTools = mcpManager.getAllTools()
    const tools = mcpToolsToProviderTools(mcpTools)

    // Initialize conversation
    coworkMessages = [
      { role: 'system', content: COWORK_SYSTEM_PROMPT + `\n\nAvailable tools: ${tools.map(t => t.name).join(', ')}` },
      { role: 'user', content: task }
    ]

    const llmProvider = llmRouter.getProvider(provider)

    try {
      await runCoworkLoop(llmProvider, coworkMessages, tools, accessToken, win, model, reasoningEffort as 'low' | 'medium' | 'high' | undefined, mcpManager)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        safeSend(win, 'cowork:complete', { summary: 'Task stopped by user.' })
      } else {
        safeSend(win, 'cowork:error', {
          error: err instanceof Error ? err.message : String(err)
        })
      }
    } finally {
      activeController = null
    }
  })

  ipcMain.handle('cowork:stop', (_event, provider?: string) => {
    if (activeController) {
      activeController.abort()
      activeController = null
    }
    if (provider) {
      llmRouter.abort(provider)
    }
  })

  ipcMain.handle('cowork:follow-up', async (event, instruction: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    // Add follow-up instruction to messages
    coworkMessages.push({ role: 'user', content: instruction })
    safeSend(win, 'cowork:stream', { chunk: `\n\n---\n**Follow-up:** ${instruction}\n\n` })
  })
}

async function runCoworkLoop(
  provider: ReturnType<LLMRouter['getProvider']>,
  messages: ChatMessage[],
  tools: ReturnType<typeof mcpToolsToProviderTools>,
  accessToken: string,
  win: BrowserWindow,
  model?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
  mcpManager?: MCPManager
): Promise<void> {
  // Bail out early if window is gone
  if (win.isDestroyed()) return

  let fullResponse = ''
  let planParsed = false
  let planBuffer = ''

  const result = await provider.sendMessage(
    messages,
    tools,
    accessToken,
    {
      onToken: (text) => {
        fullResponse += text
        planBuffer += text

        // Parse plan lines
        if (!planParsed) {
          const planLines = parsePlanLines(planBuffer)
          if (planLines.length > 0) {
            const lines = planBuffer.split('\n')
            const hasNonPlan = lines.some(l => l.trim().length > 0 && !l.trim().startsWith('PLAN:') && planLines.length > 0)
            if (hasNonPlan || planLines.length >= 2) {
              safeSend(win, 'cowork:plan', { steps: planLines })
              planParsed = true
            }
          }
        }

        // Parse step markers
        parseStepMarkers(text, win)

        // Stream text to renderer
        safeSend(win, 'cowork:stream', { chunk: text })
      },
      onToolCall: (toolCall) => {
        safeSend(win, 'cowork:tool-call', {
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.arguments
        })
      },
      onComplete: () => {},
      onError: (error) => {
        safeSend(win, 'cowork:error', { error: error.message })
      }
    },
    model,
    reasoningEffort
  )

  if (win.isDestroyed()) return

  if (result.stopReason === 'tool_use' && result.toolCalls && mcpManager) {
    // Save assistant message
    messages.push({ role: 'assistant', content: fullResponse || '[tool call]' })

    // Execute tools
    const toolResults = await executeCoworkToolCalls(result.toolCalls, mcpManager, win)

    // Add tool results to messages
    for (const tr of toolResults) {
      messages.push({
        role: 'tool',
        content: tr.content,
        toolCallId: tr.toolCallId
      })
    }

    // Continue the loop
    await runCoworkLoop(provider, messages, tools, accessToken, win, model, reasoningEffort, mcpManager)
  } else {
    // Task complete
    messages.push({ role: 'assistant', content: fullResponse })
    safeSend(win, 'cowork:complete', { summary: fullResponse })
  }
}

function parsePlanLines(text: string): string[] {
  const lines = text.split('\n')
  const planLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('PLAN:')) {
      planLines.push(trimmed.replace('PLAN:', '').trim())
    }
  }
  return planLines
}

let lastStepBuffer = ''
function parseStepMarkers(text: string, win: BrowserWindow): void {
  lastStepBuffer += text
  const lines = lastStepBuffer.split('\n')
  lastStepBuffer = lines.pop() ?? ''

  for (const line of lines) {
    const trimmed = line.trim()
    const startMatch = trimmed.match(/^STEP_START:\s*(\d+)/)
    if (startMatch) {
      safeSend(win, 'cowork:step-start', { step: parseInt(startMatch[1]) })
    }
    const completeMatch = trimmed.match(/^STEP_COMPLETE:\s*(\d+)/)
    if (completeMatch) {
      safeSend(win, 'cowork:step-complete', { step: parseInt(completeMatch[1]) })
    }
  }
}

async function executeCoworkToolCalls(
  toolCalls: ToolCall[],
  mcpManager: MCPManager,
  win: BrowserWindow
): Promise<Array<{ toolCallId: string; content: string }>> {
  const results: Array<{ toolCallId: string; content: string }> = []

  for (const tc of toolCalls) {
    try {
      const result = await mcpManager.callTool(tc.name, tc.arguments)
      const text = result.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text ?? '')
        .join('\n')

      const content = result.isError ? `Error: ${text}` : text
      results.push({ toolCallId: tc.id, content })

      safeSend(win, 'cowork:tool-result', {
        id: tc.id,
        result: content,
        status: result.isError ? 'error' : 'success'
      })
    } catch (err) {
      const errMsg = `Error executing tool ${tc.name}: ${err instanceof Error ? err.message : String(err)}`
      results.push({ toolCallId: tc.id, content: errMsg })

      safeSend(win, 'cowork:tool-result', {
        id: tc.id,
        result: errMsg,
        status: 'error'
      })
    }
  }

  return results
}
