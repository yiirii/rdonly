import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync('src/ui/theme.css', 'utf8')
const root = css.match(/:root\s*{([^}]*)}/)?.[1] ?? ''

describe('theme tokens', () => {
  it('contains no gradients anywhere', () => {
    expect(css).not.toMatch(/gradient\(/i)
  })
  it.each(['--bg', '--surface', '--surface-2', '--edge', '--text', '--text-dim', '--accent', '--danger', '--lip'])(
    'defines %s in :root', (token) => {
      expect(root).toMatch(new RegExp(`${token}\\s*:`))
    })
})

describe('animation rules', () => {
  it('only transitions transform or opacity', () => {
    const transitions = [...css.matchAll(/transition\s*:\s*([^;]+);/g)].map((m) => m[1])
    for (const t of transitions) {
      if (/^\s*[\d.]+m?s\b/.test(t) || t.includes('!important')) continue // duration-only overrides
      for (const part of t.split(',')) expect(part.trim().split(/\s+/)[0]).toMatch(/^(transform|opacity)$/)
    }
  })
})
