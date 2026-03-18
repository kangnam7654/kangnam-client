// ── Shared provider/model constants ─────────────────────────

export interface ProviderInfo {
  name: string
  label: string
  shortLabel: string
  color: string
  icon: string
}

export interface ModelInfo {
  id: string
  label: string
  desc: string
  contextWindow: number  // max tokens
}

// All providers — devMode-only ones marked with devOnly: true
export const ALL_PROVIDERS: (ProviderInfo & { devOnly?: boolean })[] = [
  { name: 'codex', label: 'OpenAI Codex', shortLabel: 'Codex', color: '#10a37f', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { name: 'gemini', label: 'Google Gemini', shortLabel: 'Gemini', color: '#4285f4', icon: 'M12 3v18m0-18c4.97 0 9 2.69 9 6s-4.03 6-9 6-9-2.69-9-6 4.03-6 9-6z', devOnly: true },
  { name: 'antigravity', label: 'Antigravity', shortLabel: 'Antigravity', color: '#ea4335', icon: 'M12 2L2 19.5h20L12 2zm0 4l7 12H5l7-12z', devOnly: true },
  { name: 'copilot', label: 'GitHub Copilot', shortLabel: 'Copilot', color: '#6e40c9', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm4 0h-2v-2h2v2zm1.5-4.5c-.4.5-1 .9-1.5 1.2V13h-2v-.8c0-.7.4-1.3 1-1.7.5-.3.8-.6 1-1 .2-.4.2-.8 0-1.2-.3-.5-.9-.8-1.5-.8-.8 0-1.5.5-1.7 1.2L10 8.3C10.5 6.9 11.8 6 13.3 6c1.1 0 2.1.5 2.7 1.4.6.9.7 2 .2 3z' },
  { name: 'claude', label: 'Anthropic Claude', shortLabel: 'Claude', color: '#d97706', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 2.3L6 8.5v7L12 18.7l6-3.2v-7L12 5.3z', devOnly: true },
  { name: 'mock', label: 'Mock (UI Test)', shortLabel: 'Mock', color: '#f59e0b', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', devOnly: true }
]

/** Visible providers — filtered by devMode setting */
export function getVisibleProviders(devMode: boolean): ProviderInfo[] {
  if (devMode) return ALL_PROVIDERS
  return ALL_PROVIDERS.filter(p => !p.devOnly)
}

/** @deprecated Use getVisibleProviders() instead. Kept for backward compat. */
export const PROVIDERS: ProviderInfo[] = ALL_PROVIDERS

export const PROVIDER_MODELS: Record<string, ModelInfo[]> = {
  codex: [
    { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Latest flagship', contextWindow: 128000 },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: 'Coding optimized', contextWindow: 128000 },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', desc: 'Coding optimized', contextWindow: 128000 },
    { id: 'gpt-5.2', label: 'GPT-5.2', desc: 'General purpose', contextWindow: 128000 },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', desc: 'Coding', contextWindow: 128000 },
    { id: 'gpt-5.1', label: 'GPT-5.1', desc: 'General purpose', contextWindow: 128000 },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex', desc: 'Legacy', contextWindow: 128000 },
    { id: 'gpt-5', label: 'GPT-5', desc: 'Legacy', contextWindow: 128000 }
  ],
  gemini: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', desc: 'Frontier reasoning (preview)', contextWindow: 1000000 },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: 'Fast reasoning (preview)', contextWindow: 1000000 }
  ],
  antigravity: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', desc: 'Frontier reasoning (preview)', contextWindow: 1000000 },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: 'Fast reasoning (preview)', contextWindow: 1000000 },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Anthropic coding', contextWindow: 200000 },
    { id: 'claude-sonnet-4-6-thinking', label: 'Claude Sonnet 4.6 Thinking', desc: 'Extended thinking', contextWindow: 200000 },
    { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6 Thinking', desc: 'Highest capability', contextWindow: 200000 }
  ],
  copilot: [
    { id: 'gpt-4.1', label: 'GPT-4.1', desc: 'Default', contextWindow: 128000 },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', desc: 'Fast, included', contextWindow: 128000 },
    { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Latest flagship', contextWindow: 128000 },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: 'Coding optimized', contextWindow: 128000 },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', desc: 'Best coding', contextWindow: 128000 },
    { id: 'gpt-5.2', label: 'GPT-5.2', desc: 'General purpose', contextWindow: 128000 },
    { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', desc: 'Max coding', contextWindow: 128000 },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', desc: 'Coding', contextWindow: 128000 },
    { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini', desc: 'Light coding', contextWindow: 128000 },
    { id: 'gpt-5.1', label: 'GPT-5.1', desc: 'General purpose', contextWindow: 128000 },
    { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', desc: 'Highest capability', contextWindow: 200000 },
    { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', desc: 'Best value coding', contextWindow: 200000 },
    { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', desc: 'Fast, lightweight', contextWindow: 200000 },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: 'Frontier reasoning (preview)', contextWindow: 1000000 },
    { id: 'gemini-3-pro', label: 'Gemini 3 Pro', desc: 'Reasoning (preview)', contextWindow: 1000000 },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Fast reasoning (preview)', contextWindow: 1000000 },
    { id: 'grok-code-fast-1', label: 'Grok Code Fast 1', desc: 'xAI fast coding', contextWindow: 128000 }
  ],
  claude: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: 'Highest capability', contextWindow: 200000 },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Best value coding', contextWindow: 200000 },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: 'Fast, lightweight', contextWindow: 200000 }
  ],
  mock: [
    { id: 'mock', label: 'Mock', desc: 'UI testing', contextWindow: 128000 }
  ]
}

// ── Token estimation ──

export function estimateTokens(text: string): number {
  if (!text) return 0
  const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length
  const totalChars = text.length
  const koreanRatio = totalChars > 0 ? koreanChars / totalChars : 0
  const charsPerToken = 4 - (koreanRatio * 2.5)
  return Math.ceil(totalChars / charsPerToken)
}

export function getContextWindow(provider: string, modelId: string): number {
  const models = PROVIDER_MODELS[provider] ?? []
  return models.find(m => m.id === modelId)?.contextWindow ?? 128000
}

export const DEFAULT_MODELS: Record<string, string> = {
  codex: 'gpt-5.4',
  gemini: 'gemini-3.1-pro-preview',
  antigravity: 'gemini-3.1-pro-preview',
  copilot: 'gpt-4.1',
  claude: 'claude-sonnet-4-6',
  mock: 'mock'
}

export const REASONING_EFFORTS = [
  { id: 'low' as const, label: 'Low', shortLabel: 'L', desc: 'Fast, minimal thinking' },
  { id: 'medium' as const, label: 'Medium', shortLabel: 'M', desc: 'Balanced (default)' },
  { id: 'high' as const, label: 'High', shortLabel: 'H', desc: 'Deep reasoning' }
]

export const REASONING_SUPPORTED_PROVIDERS = new Set(['codex', 'gemini', 'antigravity', 'claude'])

export function getProviderInfo(name: string): ProviderInfo | undefined {
  return PROVIDERS.find(p => p.name === name)
}

export function getModelLabel(provider: string, modelId: string): string {
  const models = PROVIDER_MODELS[provider] ?? []
  return models.find(m => m.id === modelId)?.label ?? modelId
}
