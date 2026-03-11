import { LLMProvider } from './base-provider'
import { CodexProvider } from './codex-provider'
import { GeminiProvider } from './gemini-provider'
import { AntigravityProvider } from './antigravity-provider'
import { CopilotProvider } from './copilot-provider'

export class LLMRouter {
  private providers = new Map<string, LLMProvider>()

  constructor() {
    const codex = new CodexProvider()
    const gemini = new GeminiProvider()
    const antigravity = new AntigravityProvider()
    const copilot = new CopilotProvider()

    this.providers.set(codex.name, codex)
    this.providers.set(gemini.name, gemini)
    this.providers.set(antigravity.name, antigravity)
    this.providers.set(copilot.name, copilot)
  }

  getProvider(name: string): LLMProvider {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new Error(`Unknown provider: ${name}. Available: ${[...this.providers.keys()].join(', ')}`)
    }
    return provider
  }

  listProviders(): Array<{ name: string; displayName: string }> {
    return [...this.providers.values()].map(p => ({
      name: p.name,
      displayName: p.displayName
    }))
  }

  abort(providerName: string): void {
    this.providers.get(providerName)?.abort()
  }
}
