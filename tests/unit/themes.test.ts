import { describe, it, expect } from 'vitest'
import { READING_THEMES, contrastRatio } from '../../src/reader/novel/themes'
import { LOCAL_ONLY_SETTINGS } from '../../src/state/settings'

describe('reading themes', () => {
  it('has the four starter themes', () => {
    expect(READING_THEMES.map((t) => t.id)).toEqual(['paper', 'sepia', 'night', 'oled'])
  })
  it.each(READING_THEMES.map((t) => [t.name, t] as const))('%s is comfortable to read (contrast 7–15)', (_, t) => {
    const c = contrastRatio(t.bg, t.fg)
    expect(c).toBeGreaterThanOrEqual(7)
    expect(c).toBeLessThanOrEqual(15)
  })
  it('never uses pure white text on pure black', () => {
    for (const t of READING_THEMES) expect(t.bg === '#000000' && t.fg.toLowerCase() === '#ffffff').toBe(false)
  })
  it('contrastRatio matches the WCAG formula', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})

describe('settings that stay on this device', () => {
  it('font size, page turn and haptics never sync', () => {
    expect(LOCAL_ONLY_SETTINGS).toEqual(expect.arrayContaining(['fontSize', 'pageTurn', 'haptics']))
    expect(LOCAL_ONLY_SETTINGS).not.toContain('theme')
  })
})
