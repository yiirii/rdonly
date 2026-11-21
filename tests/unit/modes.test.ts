import { describe, it, expect } from 'vitest'
import { modeFor } from '../../src/reader/modes'

describe('modeFor', () => {
  it.each([
    ['novel', 'novel'], ['manga', 'paged-rtl'], ['comic', 'paged-ltr'], ['webtoon', 'webtoon'], ['document', 'pdf'],
  ] as const)('%s → %s', (tag, mode) => expect(modeFor({ tag, format: tag === 'novel' ? 'epub' : tag === 'document' ? 'pdf' : 'cbz' })).toBe(mode))
  it('the file format decides when the tag cannot be read that way', () => {
    expect(modeFor({ format: 'epub', tag: 'manga' })).toBe('novel')
    expect(modeFor({ format: 'epub', tag: 'document' })).toBe('novel')
    expect(modeFor({ format: 'pdf', tag: 'novel' })).toBe('pdf')
    expect(modeFor({ format: 'cbr', tag: 'novel' })).toBe('paged-ltr')
    expect(modeFor({ format: 'cbz', tag: 'document' })).toBe('paged-ltr')
  })
  it('an override that does not fit the format is ignored', () => {
    expect(modeFor({ format: 'epub', tag: 'novel', modeOverride: 'webtoon' })).toBe('novel')
  })
  it('a per-book override wins', () => {
    expect(modeFor({ format: 'cbz', tag: 'manga', modeOverride: 'paged-ltr' })).toBe('paged-ltr')
  })
  it('ignores an unknown override', () => {
    expect(modeFor({ format: 'cbz', tag: 'manga', modeOverride: 'banana' })).toBe('paged-rtl')
  })
})
