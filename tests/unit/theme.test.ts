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
