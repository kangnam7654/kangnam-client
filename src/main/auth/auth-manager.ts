import { BrowserWindow, shell } from 'electron'
import { deleteToken, getToken, listTokenProviders, saveToken, StoredToken } from './token-store'

export interface AuthStatus {
  provider: string
  connected: boolean
  expiresAt: number | null
}

type AuthCallback = (provider: string, token: StoredToken) => void

export class AuthManager {
  private pendingCallbacks = new Map<string, AuthCallback>()
  private mainWindow: BrowserWindow | null = null
  private onConnectedListeners: ((provider: string) => void)[] = []

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  onConnected(listener: (provider: string) => void): void {
    this.onConnectedListeners.push(listener)
  }

  async connect(provider: string): Promise<void> {
    switch (provider) {
      case 'codex':
        await this.startCodexOAuth()
        break
      case 'gemini':
        await this.startGeminiOAuth()
        break
      case 'antigravity':
        await this.startAntigravityOAuth()
        break
      case 'copilot':
        await this.startCopilotDeviceFlow()
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  async disconnect(provider: string): Promise<void> {
    deleteToken(provider)
    this.mainWindow?.webContents.send('auth:on-disconnected', provider)
  }

  getStatus(): AuthStatus[] {
    const providers = ['codex', 'gemini', 'antigravity', 'copilot']
    const connectedProviders = listTokenProviders()
    return providers.map(p => {
      const token = connectedProviders.includes(p) ? getToken(p) : null
      return {
        provider: p,
        connected: !!token,
        expiresAt: token?.expires_at ?? null
      }
    })
  }

  getAccessToken(provider: string): string | null {
    const token = getToken(provider)
    if (!token) return null

    // Check expiration
    if (token.expires_at && Date.now() / 1000 > token.expires_at) {
      // TODO: Implement token refresh per provider
      return null
    }

    return token.access_token
  }

  handleOAuthCallback(url: string): void {
    // Parse kangnam-client://callback?provider=xxx&code=yyy
    try {
      const parsed = new URL(url)
      const provider = parsed.searchParams.get('provider')
      const code = parsed.searchParams.get('code')

      if (provider && code) {
        this.exchangeCodeForToken(provider, code)
      }
    } catch {
      console.error('Failed to parse OAuth callback URL:', url)
    }
  }

  // --- Provider-specific OAuth flows ---

  private async startCodexOAuth(): Promise<void> {
    // OpenAI Codex OAuth: opens browser for ChatGPT login
    // The actual OAuth URL/client_id depends on the OpenAI OAuth spec
    // Reference: open-hax/codex implementation
    const authUrl = 'https://auth.openai.com/authorize?' + new URLSearchParams({
      response_type: 'code',
      redirect_uri: 'kangnam-client://callback?provider=codex',
      scope: 'openid profile email',
      // client_id will need to be obtained or reverse-engineered
      client_id: 'CODEX_CLIENT_ID_PLACEHOLDER'
    }).toString()

    await shell.openExternal(authUrl)
  }

  private async startGeminiOAuth(): Promise<void> {
    // Google OAuth for Gemini CLI
    const authUrl = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
      response_type: 'code',
      redirect_uri: 'kangnam-client://callback?provider=gemini',
      scope: 'openid email profile https://www.googleapis.com/auth/cloud-platform',
      client_id: 'GEMINI_CLIENT_ID_PLACEHOLDER',
      access_type: 'offline',
      prompt: 'consent'
    }).toString()

    await shell.openExternal(authUrl)
  }

  private async startAntigravityOAuth(): Promise<void> {
    // Google OAuth for Antigravity (additional scopes)
    const authUrl = 'https://accounts.google.com/o/oauth2/auth?' + new URLSearchParams({
      response_type: 'code',
      redirect_uri: 'kangnam-client://callback?provider=antigravity',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/cclog',
        'https://www.googleapis.com/auth/experimentsandconfigs'
      ].join(' '),
      client_id: 'ANTIGRAVITY_CLIENT_ID_PLACEHOLDER',
      access_type: 'offline',
      prompt: 'consent'
    }).toString()

    await shell.openExternal(authUrl)
  }

  private async startCopilotDeviceFlow(): Promise<void> {
    // GitHub Copilot Device Flow
    // Step 1: Request device code
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        // VSCode's OAuth client_id (required for Copilot)
        client_id: '01ab8ac9400c4e429b23',
        scope: 'read:user'
      })
    })

    const data = (await response.json()) as {
      device_code: string
      user_code: string
      verification_uri: string
      expires_in: number
      interval: number
    }

    // Send user_code to renderer for display
    this.mainWindow?.webContents.send('auth:copilot-device-code', {
      userCode: data.user_code,
      verificationUri: data.verification_uri
    })

    // Open browser for user to enter code
    await shell.openExternal(data.verification_uri)

    // Step 2: Poll for completion
    await this.pollCopilotToken(data.device_code, data.interval, data.expires_in)
  }

  private async pollCopilotToken(deviceCode: string, interval: number, expiresIn: number): Promise<void> {
    const deadline = Date.now() + expiresIn * 1000

    const poll = async (): Promise<void> => {
      if (Date.now() > deadline) {
        throw new Error('Copilot device flow timed out')
      }

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: '01ab8ac9400c4e429b23',
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })

      const data = (await response.json()) as {
        access_token?: string
        error?: string
      }

      if (data.access_token) {
        // Step 3: Exchange for Copilot token
        const copilotToken = await this.exchangeCopilotToken(data.access_token)

        saveToken({
          provider: 'copilot',
          access_token: copilotToken,
          refresh_token: data.access_token, // GitHub OAuth token used to refresh Copilot token
          expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 min
          metadata: { github_token: data.access_token }
        })

        this.mainWindow?.webContents.send('auth:on-connected', 'copilot')
        this.onConnectedListeners.forEach(l => l('copilot'))
        return
      }

      if (data.error === 'authorization_pending' || data.error === 'slow_down') {
        const waitMs = data.error === 'slow_down' ? (interval + 5) * 1000 : interval * 1000
        await new Promise(resolve => setTimeout(resolve, waitMs))
        return poll()
      }

      throw new Error(`Copilot auth error: ${data.error}`)
    }

    await poll()
  }

  private async exchangeCopilotToken(githubToken: string): Promise<string> {
    const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/json',
        'Editor-Version': 'vscode/1.97.0',
        'Editor-Plugin-Version': 'copilot/1.0.0'
      }
    })

    const data = (await response.json()) as { token: string }
    return data.token
  }

  private async exchangeCodeForToken(provider: string, code: string): Promise<void> {
    // TODO: Implement per-provider token exchange
    // This is called when the OAuth callback is received with an auth code
    // Each provider has different token exchange endpoints

    console.log(`Exchanging code for ${provider} token...`)

    // Placeholder - actual implementation depends on provider
    saveToken({
      provider,
      access_token: code, // Temporary - should be exchanged
      refresh_token: null,
      expires_at: null,
      metadata: null
    })

    this.mainWindow?.webContents.send('auth:on-connected', provider)
    this.onConnectedListeners.forEach(l => l(provider))
  }
}
