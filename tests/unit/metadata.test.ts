import { describe, it, expect } from 'vitest'
import { extractMeta } from '../../src/core/metadata'
import { defaultTag } from '../../src/core/tags'
import { fixture } from './fixtures'

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
  // Corrupt the compressed data of one entry: a full unzip would throw, a selective one must not.
  const corruptEntry = async (bytes: Uint8Array, name: string) => {
    const out = bytes.slice()
    const nameBytes = new TextEncoder().encode(name)
    for (let i = 0; i < out.length - 30; i++) {
      if (out[i] === 0x50 && out[i + 1] === 0x4b && out[i + 2] === 3 && out[i + 3] === 4) {
        const nlen = out[i + 26] | (out[i + 27] << 8), xlen = out[i + 28] | (out[i + 29] << 8)
        const entry = out.slice(i + 30, i + 30 + nlen)
        if (entry.length === nameBytes.length && entry.every((b, k) => b === nameBytes[k])) {
          const data = i + 30 + nlen + xlen
          for (let k = 0; k < 8; k++) out[data + k] = 0xff
          return out
        }
      }
    }
    throw new Error(`entry ${name} not found`)
  }
  it('CBZ: ignores damage in pages after the cover', async () => {
    const m = await extractMeta('cbz', await corruptEntry(fixture('manga.cbz'), '3.png'))
    expect(m.series).toBe('Test Manga')
    expect(m.cover?.type).toBe('image/png')
  })
  it('EPUB: ignores damage in chapters', async () => {
    const m = await extractMeta('epub', await corruptEntry(fixture('novel.epub'), 'OEBPS/ch1.xhtml'))
    expect(m.title).toBe('Test Novel')
  })
})
