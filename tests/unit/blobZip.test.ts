import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { readZipIndex, readZipEntry } from '../../src/archive/blobZip'
import { openPageSource } from '../../src/archive/pageSource'
import { fixture } from './fixtures'
import { corruptEntry } from './zipUtil'

const blobOf = (b: Uint8Array) => new Blob([b as unknown as BlobPart])
const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

/** A Blob that records which byte ranges were read. */
function spyBlob(b: Uint8Array) {
  const real = blobOf(b)
  const reads: [number, number][] = []
  const spy = { size: real.size, type: '', slice(a = 0, z = real.size) { reads.push([a, z]); return real.slice(a, z) } }
  return { blob: spy as unknown as Blob, reads }
}

describe('readZipIndex', () => {
  it('lists every entry with sizes', async () => {
    const idx = await readZipIndex(blobOf(fixture('manga.cbz')))
    expect(idx.map((e) => e.name).sort()).toEqual(['1.png', '2.png', '3.png', 'ComicInfo.xml'])
    expect(idx.every((e) => e.size > 0 && e.compressedSize > 0)).toBe(true)
  })
  it('reads ZIP64 archives', async () => {
    const idx = await readZipIndex(blobOf(fixture('zip64.cbz')))
    expect(idx.map((e) => e.name)).toEqual(['1.png', '2.png'])
  })
  it('rejects something that is not a zip', async () => {
    await expect(readZipIndex(blobOf(fixture('doc.pdf')))).rejects.toThrow()
  })
})

describe('readZipEntry', () => {
  it('returns the same bytes as a full unzip', async () => {
    for (const name of ['manga.cbz', 'novel.epub', 'zip64.cbz']) {
      const raw = fixture(name)
      const all = unzipSync(raw)
      const blob = blobOf(raw)
      for (const e of await readZipIndex(blob)) expect(Array.from(await readZipEntry(blob, e))).toEqual(Array.from(all[e.name]))
    }
  })
  it('only reads the directory and the one entry it needs', async () => {
    const raw = fixture('manga.cbz')
    const { blob, reads } = spyBlob(raw)
    const idx = await readZipIndex(blob)
    const before = reads.length
    const e = idx.find((x) => x.name === '2.png')!
    await readZipEntry(blob, e)
    const entryReads = reads.slice(before)
    const touched = entryReads.reduce((n, [a, z]) => n + (z - a), 0)
    expect(touched).toBeLessThan(e.compressedSize + 30 + 64 + e.name.length + 1)
  })
  it('never reads a large archive whole', async () => {
    const { zipSync } = await import('fflate')
    const raw = zipSync({ 'big.bin': [new Uint8Array(300_000).map((_, i) => (i * 7919) & 255), { level: 0 }], '1.png': fixture('plain.cbz').slice(0, 10) })
    const { blob, reads } = spyBlob(raw)
    const idx = await readZipIndex(blob)
    await readZipEntry(blob, idx.find((e) => e.name === '1.png')!)
    expect(Math.max(...reads.map(([a, z]) => z - a))).toBeLessThan(70_000)
  })
  it('a damaged entry fails on its own', async () => {
    const blob = blobOf(corruptEntry(fixture('manga.cbz'), '3.png'))
    const idx = await readZipIndex(blob)
    await expect(readZipEntry(blob, idx.find((e) => e.name === '3.png')!)).rejects.toThrow()
    expect((await readZipEntry(blob, idx.find((e) => e.name === '1.png')!)).length).toBeGreaterThan(0)
  })
})

describe('openPageSource (cbz)', () => {
  it('serves pages in natural order as images', async () => {
    const src = await openPageSource(blobOf(fixture('plain.cbz')), 'cbz')
    expect(src.count).toBe(3)
    expect(src.names).toEqual(['1.png', '2.png', '10.png'])
    const p = await src.page(0)
    expect(p.type).toBe('image/png')
    expect(Array.from(await bytes(p))).toEqual(Array.from(unzipSync(fixture('plain.cbz'))['1.png']))
  })
})
