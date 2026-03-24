import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('handles undefined inputs', () => {
    const result = cn('foo', undefined, 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('handles empty string', () => {
    const result = cn('')
    expect(result).toBe('')
  })

  it('handles no inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('merges tailwind classes correctly', () => {
    // twMerge should handle conflicting tailwind classes
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const result = cn('base', isActive && 'active')
    expect(result).toContain('base')
    expect(result).toContain('active')
  })

  it('handles false conditional', () => {
    const isActive = false
    const result = cn('base', isActive && 'active')
    expect(result).toContain('base')
    expect(result).not.toContain('active')
  })
})
