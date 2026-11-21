import { describe, it, expect } from 'vitest'
import { createLibraryStore } from '../../src/state/library'
import { appIsCalm } from '../../src/state/calm'
import { fixture } from './fixtures'
import { memFiles, memRecords } from './fakes'

const file = (n: string) => new File([fixture(n) as unknown as BlobPart], n)

describe('appIsCalm', () => {
  it('is not calm while an import is running', async () => {
    document.body.innerHTML = ''
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const records = memRecords()
    const put = records.put
    records.put = async (c, r) => { await gate; return put(c, r) }
    const store = createLibraryStore({ records, files: memFiles(), thumb: async () => undefined })
    expect(appIsCalm(store)).toBe(true)
    const running = store.getState().import([file('novel.epub')])
    await new Promise((r) => setTimeout(r, 10))
    expect(appIsCalm(store)).toBe(false)
    release(); await running
    expect(appIsCalm(store)).toBe(true)
  })
})

describe('overlapping imports', () => {
  it('run one after another and both land', async () => {
    const store = createLibraryStore({ records: memRecords(), files: memFiles(), thumb: async () => undefined })
    const [a, b] = await Promise.all([store.getState().import([file('novel.epub')]), store.getState().import([file('manga.cbz')])])
    expect(a[0].status).toBe('added'); expect(b[0].status).toBe('added')
    expect(store.getState().books).toHaveLength(2)
    expect(store.getState().busy).toBe(false)
  })
})

describe('import queue', () => {
  it('does not start reading a second batch until the first is saved', async () => {
    const order: string[] = []
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const records = memRecords()
    const put = records.put
    records.put = async (c, r) => { await gate; order.push(`saved ${(r as { fileName?: string }).fileName}`); return put(c, r) }
    const store = createLibraryStore({ records, files: memFiles(), thumb: async () => undefined })
    const spyFile = (n: string) => { const f = file(n); const ab = f.arrayBuffer.bind(f); f.arrayBuffer = async () => { order.push(`read ${n}`); return ab() }; return f }
    const a = store.getState().import([spyFile('novel.epub')])
    const b = store.getState().import([spyFile('manga.cbz')])
    await new Promise((r) => setTimeout(r, 20))
    release()
    await Promise.all([a, b])
    expect(order).toEqual(['read novel.epub', 'saved novel.epub', 'read manga.cbz', 'saved manga.cbz'])
  })
})
