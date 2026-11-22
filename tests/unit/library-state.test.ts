import { describe, it, expect, beforeEach } from 'vitest'
import { createLibraryStore } from '../../src/state/library'
import { fixture } from './fixtures'
import { memFiles, memRecords } from './fakes'

const file = (name: string) => new File([fixture(name) as unknown as BlobPart], name)

describe('library store', () => {
  let store: ReturnType<typeof createLibraryStore>
  let t = 0
  beforeEach(() => {
    t = 0
    store = createLibraryStore({ records: memRecords(), files: memFiles(), now: () => ++t * 1000, thumb: async () => undefined })
  })

  it('imports files and lists newest first', async () => {
    await store.getState().import([file('novel.epub'), file('manga.cbz')])
    expect(store.getState().books.map((b) => b.title)).toEqual(['Test Manga Vol. 3', 'Test Novel'])
  })
  it('sorts by title when asked', async () => {
    await store.getState().import([file('novel.epub'), file('manga.cbz')])
    store.getState().setSort('title')
    expect(store.getState().books.map((b) => b.title)).toEqual(['Test Manga Vol. 3', 'Test Novel'])
    store.getState().setSort('added')
    await store.getState().import([file('bare.epub')])
    expect(store.getState().books[0].title).toBe('bare')
    store.getState().setSort('title')
    expect(store.getState().books.map((b) => b.title)).toEqual(['bare', 'Test Manga Vol. 3', 'Test Novel'])
  })
  it('load() reads what is already stored', async () => {
    const records = memRecords(), files = memFiles()
    const a = createLibraryStore({ records, files, thumb: async () => undefined })
    await a.getState().import([file('novel.epub')])
    const b = createLibraryStore({ records, files })
    await b.getState().load()
    expect(b.getState().books).toHaveLength(1)
    expect(b.getState().loaded).toBe(true)
  })
})

describe('import summary', () => {
  it('describes results in plain sentences', async () => {
    const { summarize } = await import('../../src/state/library')
    expect(summarize([
      { fileName: 'a.epub', status: 'added' }, { fileName: 'b.cbz', status: 'added' },
      { fileName: 'c.epub', status: 'duplicate' }, { fileName: 'book.mobi', status: 'unsupported' },
    ])).toBe('Added 2 books. 1 was already in your library. Couldn’t open book.mobi.')
    expect(summarize([{ fileName: 'x.epub', status: 'relinked' }])).toBe('Restored the file for 1 book.')
    expect(summarize([{ fileName: 'a.epub', status: 'added' }])).toBe('Added 1 book.')
  })
})

describe('overlapping loads', () => {
  it('a slow older load never overwrites a newer one', async () => {
    const records = memRecords()
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const list = records.list
    let first = true
    records.list = (async (c: string, o?: { includeDeleted?: boolean }) => { if (c === 'books' && first) { first = false; const out = await list(c, o); await gate; return out } return list(c, o) }) as typeof records.list
    const store = createLibraryStore({ records, files: memFiles(), thumb: async () => undefined })
    const slow = store.getState().load()          // starts first, finishes last (sees an empty library)
    await store.getState().import([file('novel.epub')])
    release(); await slow
    expect(store.getState().books).toHaveLength(1)
  })
})
