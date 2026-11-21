import { describe, it, expect } from 'vitest'
import { modeFor } from '../../src/reader/modes'

describe('modeFor', () => {
  it.each([
    ['novel', 'novel'], ['manga', 'paged-rtl'], ['comic', 'paged-ltr'], ['webtoon', 'webtoon'], ['document', 'pdf'],
  ] as const)('%s → %s', (tag, mode) => expect(modeFor({ tag })).toBe(mode))
  it('a per-book override wins', () => {
    expect(modeFor({ tag: 'manga', modeOverride: 'paged-ltr' })).toBe('paged-ltr')
  })
  it('ignores an unknown override', () => {
    expect(modeFor({ tag: 'manga', modeOverride: 'banana' })).toBe('paged-rtl')
  })
})
