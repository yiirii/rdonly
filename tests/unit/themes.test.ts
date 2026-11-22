import { describe, it, expect } from 'vitest'
import { READING_THEMES, contrastRatio, themeById } from '../../src/reader/novel/themes'
import { LOCAL_ONLY_SETTINGS, normalizeSettings, DEFAULT_SETTINGS } from '../../src/state/settings'
import { FONTS, fontById } from '../../src/reader/novel/fontList'

describe('page colours', () => {
  it('has the 14 chosen colours in order', () => {
    expect(READING_THEMES.map((t) => t.id)).toEqual(['paper', 'linen', 'sepia', 'parchment', 'rose', 'sage', 'mist', 'dusk', 'slate', 'night', 'ink', 'forest', 'ember', 'oled'])
  })
  it.each(READING_THEMES.map((t) => [t.name, t] as const))('%s is comfortable to read (contrast 7–15)', (_, t) => {
    const c = contrastRatio(t.bg, t.fg)
    expect(c).toBeGreaterThanOrEqual(7); expect(c).toBeLessThanOrEqual(15)
  })
  it.each(READING_THEMES.map((t) => [t.name, t] as const))('%s says whether it is light or dark correctly', (_, t) => {
    expect(t.tone).toBe(contrastRatio(t.bg, '#000000') > contrastRatio(t.bg, '#ffffff') ? 'light' : 'dark')
  })
  it('an unknown colour falls back to Night', () => expect(themeById('nope').id).toBe('night'))
  it('contrastRatio matches the WCAG formula', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })
})

describe('fonts', () => {
  it('offers the curated seven plus the book’s own', () => {
    expect(FONTS.map((f) => f.name)).toEqual(['Newsreader', 'Vollkorn', 'Spectral', 'Instrument Sans', 'Funnel Sans', 'Host Grotesk', 'Atkinson Hyperlegible', 'Book’s own'])
  })
  it('an unknown font falls back to Newsreader', () => expect(fontById('literata').id).toBe('newsreader'))
})

describe('settings', () => {
  it('defaults: Night, Newsreader, glide', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ theme: 'night', font: 'newsreader', fontSize: 100, lineHeight: 1.6, margins: 'normal', columns: true, pageTurn: 'glide' })
  })
  it('older or broken saved values fall back to defaults', () => {
    expect(normalizeSettings({ font: 'literata', theme: 'paper', lineHeight: 9, margins: 'huge', pageTurn: 'slide' }))
      .toMatchObject({ font: 'newsreader', theme: 'paper', lineHeight: 1.6, margins: 'normal', pageTurn: 'glide' })
  })
  it('size, page turn, columns and haptics stay on this device', () => {
    expect(LOCAL_ONLY_SETTINGS).toEqual(expect.arrayContaining(['fontSize', 'pageTurn', 'columns', 'haptics']))
    expect(LOCAL_ONLY_SETTINGS).not.toContain('theme')
    expect(LOCAL_ONLY_SETTINGS).not.toContain('lineHeight')
  })
})
