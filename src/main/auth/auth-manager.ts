import { BrowserWindow, shell } from 'electron'
import { deleteToken, getToken, listTokenProviders, saveToken } from './token-store'
import { generatePKCE, generateState } from './pkce'
import { waitForOAuthCallback, startOAuthServer } from './oauth-server'

// --- OAuth Credentials (from open-source implementations) ---

const CODEX = {
  clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
  authUrl: 'https://auth.openai.com/oauth/authorize',
  tokenUrl: 'https://auth.openai.com/oauth/token',
  redirectPort: 1455,
  redirectPath: '/auth/callback',
  scopes: 'openid profile email offline_access'
}

const GEMINI = {
  clientId: '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
  clientSecret: '***REMOVED***',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  redirectPath: '/oauth2callback',
  scopes: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
}

const ANTIGRAVITY = {
  clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  clientSecret: '***REMOVED***',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  redirectPort: 51121,
  redirectPath: '/oauth-callback',
  scopes: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs'
}

const COPILOT = {
  clientId: 'Iv1.b507a08c87ecfe98',
  deviceCodeUrl: 'https://github.com/login/device/code',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  copilotTokenUrl: 'https://api.github.com/copilot_internal/v2/token',
  scope: 'read:user'
}

export interface AuthStatus {
  provider: string
  connected: boolean
  expiresAt: number | null
}

export class AuthManager {
  private mainWindow: BrowserWindow | null = null

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
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

  /**
   * Get a valid access token for the given provider.
   * Automatically refreshes expired tokens.
   */
  async getAccessToken(provider: string): Promise<string | null> {
    const token = getToken(provider)
    if (!token) return null

    const now = Math.floor(Date.now() / 1000)

    // Check if token expires within 5 minutes
    if (token.expires_at && now > token.expires_at - 300) {
      try {
        return await this.refreshToken(provider, token.refresh_token)
      } catch (err) {
        console.error(`Failed to refresh ${provider} token:`, err)
        return null
      }
    }

    return token.access_token
  }

  // ==============================
  // Codex OAuth (PKCE, no secret)
  // ==============================

  private async startCodexOAuth(): Promise<void> {
    const { codeVerifier, codeChallenge } = generatePKCE()
    const state = generateState()
    const redirectUri = `http://localhost:${CODEX.redirectPort}${CODEX.redirectPath}`

    // Start local server to receive callback
    const { promise } = waitForOAuthCallback(CODEX.redirectPort, CODEX.redirectPath)

    // Open browser for auth
    const authUrl = `${CODEX.authUrl}?` + new URLSearchParams({
      response_type: 'code',
      client_id: CODEX.clientId,
      redirect_uri: redirectUri,
      scope: CODEX.scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }).toString()

    await shell.openExternal(authUrl)

    // Wait for callback
    const result = await promise
    if (result.state !== state) {
      throw new Error('OAuth state mismatch — possible CSRF attack')
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(CODEX.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CODEX.clientId,
        code: result.code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }).toString()
    })

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text()
      throw new Error(`Codex token exchange failed: ${text}`)
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    saveToken({
      provider: 'codex',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : null,
      metadata: null
    })

    this.notifyConnected('codex')
  }

  // ==============================
  // Gemini OAuth (PKCE + secret)
  // ==============================

  private async startGeminiOAuth(): Promise<void> {
    const { codeVerifier, codeChallenge } = generatePKCE()
    const state = generateState()

    // Dynamic port allocation
    const { promise, getPort } = startOAuthServer(GEMINI.redirectPath)

    // Wait a tick for the server to get its port
    await new Promise(r => setTimeout(r, 100))
    const port = getPort()
    const redirectUri = `http://127.0.0.1:${port}${GEMINI.redirectPath}`

    const authUrl = `${GEMINI.authUrl}?` + new URLSearchParams({
      response_type: 'code',
      client_id: GEMINI.clientId,
      redirect_uri: redirectUri,
      scope: GEMINI.scopes,
      state,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }).toString()

    await shell.openExternal(authUrl)

    const result = await promise
    if (result.state !== state) {
      throw new Error('OAuth state mismatch')
    }

    // Exchange code for tokens (Gemini requires client_secret)
    const tokenResponse = await fetch(GEMINI.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: GEMINI.clientId,
        client_secret: GEMINI.clientSecret,
        code: result.code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }).toString()
    })

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text()
      throw new Error(`Gemini token exchange failed: ${text}`)
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    saveToken({
      provider: 'gemini',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : null,
      metadata: { redirect_uri: redirectUri }
    })

    this.notifyConnected('gemini')
  }

  // ==============================
  // Antigravity OAuth (PKCE + secret, extra scopes)
  // ==============================

  private async startAntigravityOAuth(): Promise<void> {
    const { codeVerifier, codeChallenge } = generatePKCE()
    const state = generateState()
    const redirectUri = `http://localhost:${ANTIGRAVITY.redirectPort}${ANTIGRAVITY.redirectPath}`

    const { promise } = waitForOAuthCallback(ANTIGRAVITY.redirectPort, ANTIGRAVITY.redirectPath)

    const authUrl = `${ANTIGRAVITY.authUrl}?` + new URLSearchParams({
      response_type: 'code',
      client_id: ANTIGRAVITY.clientId,
      redirect_uri: redirectUri,
      scope: ANTIGRAVITY.scopes,
      state,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }).toString()

    await shell.openExternal(authUrl)

    const result = await promise
    if (result.state !== state) {
      throw new Error('OAuth state mismatch')
    }

    const tokenResponse = await fetch(ANTIGRAVITY.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ANTIGRAVITY.clientId,
        client_secret: ANTIGRAVITY.clientSecret,
        code: result.code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }).toString()
    })

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text()
      throw new Error(`Antigravity token exchange failed: ${text}`)
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    saveToken({
      provider: 'antigravity',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : null,
      metadata: null
    })

    this.notifyConnected('antigravity')
  }

  // ==============================
  // GitHub Copilot (Device Flow)
  // ==============================

  private async startCopilotDeviceFlow(): Promise<void> {
    // Step 1: Request device code
    const response = await fetch(COPILOT.deviceCodeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: COPILOT.clientId,
        scope: COPILOT.scope
      })
    })

    if (!response.ok) {
      throw new Error(`Copilot device code request failed: ${response.status}`)
    }

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
    const githubToken = await this.pollCopilotToken(data.device_code, data.interval, data.expires_in)

    // Step 3: Exchange GitHub token for Copilot token
    const copilotToken = await this.exchangeCopilotToken(githubToken)

    saveToken({
      provider: 'copilot',
      access_token: copilotToken,
      refresh_token: githubToken, // GitHub token used to get new Copilot tokens
      expires_at: Math.floor(Date.now() / 1000) + 1500, // ~25 min
      metadata: null
    })

    this.notifyConnected('copilot')
  }

  private async pollCopilotToken(deviceCode: string, interval: number, expiresIn: number): Promise<string> {
    const deadline = Date.now() + expiresIn * 1000

    while (Date.now() < deadline) {
      const response = await fetch(COPILOT.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: COPILOT.clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })

      const data = (await response.json()) as {
        access_token?: string
        error?: string
      }

      if (data.access_token) {
        return data.access_token
      }

      if (data.error === 'authorization_pending') {
        await new Promise(r => setTimeout(r, interval * 1000))
        continue
      }

      if (data.error === 'slow_down') {
        await new Promise(r => setTimeout(r, (interval + 5) * 1000))
        continue
      }

      throw new Error(`Copilot auth error: ${data.error}`)
    }

    throw new Error('Copilot device flow timed out')
  }

  private async exchangeCopilotToken(githubToken: string): Promise<string> {
    const response = await fetch(COPILOT.copilotTokenUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/json',
        'Editor-Version': 'vscode/1.85.1',
        'Editor-Plugin-Version': 'copilot/1.155.0'
      }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Copilot token exchange failed: ${response.status} ${text}`)
    }

    const data = (await response.json()) as { token: string; expires_at: number }
    return data.token
  }

  // ==============================
  // Token Refresh
  // ==============================

  private async refreshToken(provider: string, refreshToken: string | null): Promise<string | null> {
    if (!refreshToken) return null

    switch (provider) {
      case 'codex':
        return this.refreshCodexToken(refreshToken)
      case 'gemini':
        return this.refreshGoogleToken('gemini', GEMINI.clientId, GEMINI.clientSecret, refreshToken)
      case 'antigravity':
        return this.refreshGoogleToken('antigravity', ANTIGRAVITY.clientId, ANTIGRAVITY.clientSecret, refreshToken)
      case 'copilot':
        return this.refreshCopilotToken(refreshToken)
      default:
        return null
    }
  }

  private async refreshCodexToken(refreshToken: string): Promise<string> {
    const response = await fetch(CODEX.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CODEX.clientId,
        refresh_token: refreshToken
      }).toString()
    })

    if (!response.ok) {
      throw new Error(`Codex token refresh failed: ${response.status}`)
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    saveToken({
      provider: 'codex',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
      expires_at: data.expires_in
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : null,
      metadata: null
    })

    return data.access_token
  }

  private async refreshGoogleToken(
    provider: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      }).toString()
    })

    if (!response.ok) {
      throw new Error(`${provider} token refresh failed: ${response.status}`)
    }

    const data = (await response.json()) as {
      access_token: string
      expires_in?: number
    }

    saveToken({
      provider,
      access_token: data.access_token,
      refresh_token: refreshToken, // Google doesn't rotate refresh tokens
      expires_at: data.expires_in
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : null,
      metadata: null
    })

    return data.access_token
  }

  private async refreshCopilotToken(githubToken: string): Promise<string> {
    // Copilot tokens are refreshed by re-exchanging the GitHub OAuth token
    const copilotToken = await this.exchangeCopilotToken(githubToken)

    saveToken({
      provider: 'copilot',
      access_token: copilotToken,
      refresh_token: githubToken,
      expires_at: Math.floor(Date.now() / 1000) + 1500,
      metadata: null
    })

    return copilotToken
  }

  // ==============================
  // Helpers
  // ==============================

  private notifyConnected(provider: string): void {
    this.mainWindow?.webContents.send('auth:on-connected', provider)
  }

  // Legacy handler — no longer needed since we use local HTTP servers
  handleOAuthCallback(_url: string): void {
    // Kept for backward compatibility with custom protocol registration
  }
}
