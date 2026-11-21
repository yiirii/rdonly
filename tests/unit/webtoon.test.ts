import { describe, it, expect } from 'vitest'
import { looksLikeWebtoon } from '../../src/core/webtoon'
import { importFiles } from '../../src/library/importBooks'
import type { BookRecord } from '../../src/library/types'
import { fixture } from './fixtures'
import { memFiles, memRecords } from './fakes'

describe('looksLikeWebtoon', () => {
  it('very tall pages are a webtoon', () => expect(looksLikeWebtoon([{ w: 800, h: 4000 }, { w: 800, h: 3000 }])).toBe(true))
  it('normal pages are not', () => expect(looksLikeWebtoon([{ w: 600, h: 900 }, { w: 600, h: 900 }])).toBe(false))
  it('goes by the median, so one odd page does not decide', () => {
    expect(looksLikeWebtoon([{ w: 600, h: 900 }, { w: 800, h: 4000 }, { w: 800, h: 4000 }])).toBe(true)
    expect(looksLikeWebtoon([{ w: 800, h: 4000 }, { w: 600, h: 900 }, { w: 600, h: 900 }])).toBe(false)
  })
  it('no sizes means no', () => expect(looksLikeWebtoon([])).toBe(false))
})

describe('import tags webtoons', () => {
  it('a comic with tall pages is tagged webtoon', async () => {
    const records = memRecords()
    const [r] = await importFiles([{ name: 'webtoon.cbz', read: async () => fixture('webtoon.cbz') }], {
      records, files: memFiles(), thumb: async () => undefined,
      pageSizes: async () => [{ w: 60, h: 400 }, { w: 60, h: 400 }, { w: 60, h: 400 }],
    })
    expect((await records.get<BookRecord>('books', r.bookId!))!.tag).toBe('webtoon')
  })
  it('a normal comic stays a comic', async () => {
    const records = memRecords()
    const [r] = await importFiles([{ name: 'plain.cbz', read: async () => fixture('plain.cbz') }], {
      records, files: memFiles(), thumb: async () => undefined, pageSizes: async () => [{ w: 60, h: 90 }],
    })
    expect((await records.get<BookRecord>('books', r.bookId!))!.tag).toBe('comic')
  })
})
