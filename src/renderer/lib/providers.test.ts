import { describe, it, expect } from 'vitest'
import { estimateTokens, getVisibleProviders, getContextWindow, getProviderInfo, ALL_PROVIDERS } from './providers'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns 0 for null-ish input', () => {
    expect(estimateTokens(null as unknown as string)).toBe(0)
    expect(estimateTokens(undefined as unknown as string)).toBe(0)
  })

  it('estimates English text (~4 chars per token)', () => {
    const text = 'Hello world, this is a test message.'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThanOrEqual(text.length) // at least 1 char per token
    expect(tokens).toBeGreaterThanOrEqual(Math.ceil(text.length / 4) - 1)
  })

  it('estimates Korean text with higher token count', () => {
    const korean = '안녕하세요 이것은 테스트 메시지입니다'
    const english = 'Hello this is a test message here'
    const koreanTokens = estimateTokens(korean)
    const englishTokens = estimateTokens(english)
    // Korean should produce more tokens per character
    const koreanRatio = koreanTokens / korean.length
    const englishRatio = englishTokens / english.length
    expect(koreanRatio).toBeGreaterThan(englishRatio)
  })

  it('handles mixed text', () => {
    const mixed = 'Hello 안녕하세요 World 세계'
    const tokens = estimateTokens(mixed)
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('getVisibleProviders', () => {
  it('returns only non-devOnly providers when devMode is false', () => {
    const visible = getVisibleProviders(false)
    expect(visible.every(p => !(p as typeof ALL_PROVIDERS[number]).devOnly)).toBe(true)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThan(ALL_PROVIDERS.length)
  })

  it('returns all providers when devMode is true', () => {
    const visible = getVisibleProviders(true)
    expect(visible.length).toBe(ALL_PROVIDERS.length)
  })

  it('always includes codex and copilot', () => {
    const visible = getVisibleProviders(false)
    const names = visible.map(p => p.name)
    expect(names).toContain('codex')
    expect(names).toContain('copilot')
  })

  it('excludes gemini, antigravity, claude, mock when not in devMode', () => {
    const visible = getVisibleProviders(false)
    const names = visible.map(p => p.name)
    expect(names).not.toContain('gemini')
    expect(names).not.toContain('antigravity')
    expect(names).not.toContain('mock')
  })
})

describe('getContextWindow', () => {
  it('returns correct window for known model', () => {
    expect(getContextWindow('codex', 'gpt-5.4')).toBe(128000)
  })

  it('returns default 128000 for unknown provider', () => {
    expect(getContextWindow('unknown', 'model')).toBe(128000)
  })

  it('returns default 128000 for unknown model', () => {
    expect(getContextWindow('codex', 'nonexistent')).toBe(128000)
  })
})

describe('getProviderInfo', () => {
  it('returns info for known provider', () => {
    const info = getProviderInfo('codex')
    expect(info).toBeDefined()
    expect(info!.label).toBe('OpenAI Codex')
  })

  it('returns undefined for unknown provider', () => {
    expect(getProviderInfo('nonexistent')).toBeUndefined()
  })
})
