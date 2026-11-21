import { describe, it, expect } from 'vitest'
import { extractMeta } from '../../src/core/metadata'
import { defaultTag } from '../../src/core/tags'
import { fixture } from './fixtures'
import { corruptEntry } from './zipUtil'

const bytesOf = async (b?: Blob) => (b ? Array.from(new Uint8Array(await b.arrayBuffer())) : undefined)

describe('EPUB metadata', () => {
  it('reads title, author, series and cover', async () => {
    const m = await extractMeta('epub', fixture('novel.epub'))
    expect(m.title).toBe('Test Novel')
    expect(m.author).toBe('A. Writer')
    expect(m.series).toBe('Test Saga')
    expect(m.volume).toBe(2)
    expect(m.cover?.type).toBe('image/png')
    expect((await bytesOf(m.cover))!.length).toBeGreaterThan(50)
  })
  it('tolerates a book with no title or cover', async () => {
    const m = await extractMeta('epub', fixture('bare.epub'))
    expect(m.title).toBeUndefined()
    expect(m.cover).toBeUndefined()
  })
})

describe('CBZ metadata', () => {
  it('reads ComicInfo series, volume, manga hint; cover is the first page', async () => {
    const m = await extractMeta('cbz', fixture('manga.cbz'))
    expect(m.series).toBe('Test Manga')
    expect(m.volume).toBe(3)
    expect(m.mangaHint).toBe(true)
    expect(m.author).toBe('M. Artist')
    expect(m.cover?.type).toBe('image/png')
  })
  it('sorts pages naturally (1, 2, 10) for the cover', async () => {
    const m = await extractMeta('cbz', fixture('plain.cbz'))
    expect(m.mangaHint).toBeFalsy()
    // 1.png is the yellow page: PNG IDAT differs per colour, so compare with the zip entry directly
    const { unzipSync } = await import('fflate')
    const one = Array.from(unzipSync(fixture('plain.cbz'))['1.png'])
    expect(await bytesOf(m.cover)).toEqual(one)
  })
  it('throws on a damaged archive', async () => {
    await expect(extractMeta('cbz', fixture('broken.cbz'))).rejects.toThrow()
  })
})

describe('defaultTag', () => {
  it.each([
    ['epub', {}, 'novel'], ['pdf', {}, 'document'],
    ['cbz', { mangaHint: true }, 'manga'], ['cbz', {}, 'comic'],
  ] as const)('%s %o → %s', (fmt, meta, tag) => expect(defaultTag(fmt, meta)).toBe(tag))
})

describe('reads only what it needs from the archive', () => {
  it('CBZ: ignores damage in pages after the cover', async () => {
    const m = await extractMeta('cbz', corruptEntry(fixture('manga.cbz'), '3.png'))
    expect(m.series).toBe('Test Manga')
    expect(m.cover?.type).toBe('image/png')
  })
  it('EPUB: ignores damage in chapters', async () => {
    const m = await extractMeta('epub', corruptEntry(fixture('novel.epub'), 'OEBPS/ch1.xhtml'))
    expect(m.title).toBe('Test Novel')
  })
})
