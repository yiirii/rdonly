import { describe, it, expect } from 'vitest'
import { bookStatus, queryLibrary, type LibraryData } from '../../src/library/query'
import type { BookRecord } from '../../src/library/types'
import type { ProgressRecord } from '../../src/state/progress'

let n = 0
const book = (title: string, o: Partial<BookRecord> = {}): BookRecord =>
  ({ id: `b${++n}`, updatedAt: 1, title, format: 'cbz', tag: 'comic', fileName: 'x', fileSize: 1, addedAt: n * 10, ...o })
const prog = (b: BookRecord, percent: number, at: number): ProgressRecord => ({ id: b.id, updatedAt: at, locator: 'page:0', percent, mode: 'paged-ltr' })

describe('bookStatus', () => {
  it('not started / reading / finished from progress', () => {
    const b = book('A')
    expect(bookStatus(b)).toBe('new')
    expect(bookStatus(b, prog(b, 0.4, 1))).toBe('reading')
    expect(bookStatus(b, prog(b, 0.985, 1))).toBe('finished')
  })
  it('a manual mark wins either way', () => {
    const b = book('A', { finished: true }), c = book('C', { finished: false })
    expect(bookStatus(b)).toBe('finished')
    expect(bookStatus(c, prog(c, 1, 1))).toBe('reading')
  })
})

describe('queryLibrary', () => {
  const novel = book('Dracula', { tag: 'novel', format: 'epub', author: 'Bram Stoker', tags: ['Horror', 'classic'] })
  const m1 = book('Harbor Vol 1', { tag: 'manga', series: 'Harbor' })
  const m2 = book('Harbor Vol 2', { tag: 'manga', series: 'harbor' })
  const comic = book('Iron Comet', { tag: 'comic', tags: ['sci-fi'] })
  const pdf = book('Field Notes', { tag: 'document', format: 'pdf', title: 'Café Notes' })
  const data: LibraryData = {
    books: [novel, m1, m2, comic, pdf],
    progress: [prog(novel, 0.5, 900), prog(m1, 1, 500), prog(comic, 0.2, 700)],
    collections: [{ id: 'c1', name: 'Want to read', color: '#e5c07b', order: 0, updatedAt: 1 }],
    items: [{ id: 'c1:' + m2.id, collectionId: 'c1', bookId: m2.id, updatedAt: 1 }, { id: 'c1:' + pdf.id, collectionId: 'c1', bookId: pdf.id, updatedAt: 1 }],
  }
  const titles = (r: ReturnType<typeof queryLibrary>) => r.items.map((i) => (i.kind === 'book' ? i.book.title : `[${i.name}: ${i.books.map((b) => b.title).join(', ')}]`))

  it('the last-read book is the newest progress, and the grid defaults to recently added', () => {
    const r = queryLibrary(data, {})
    expect(r.lastRead?.title).toBe('Dracula')
    expect(titles(r)).toEqual(['Café Notes', 'Iron Comet', '[Harbor: Harbor Vol 1, Harbor Vol 2]', 'Dracula'])
  })
  it('counts every tab', () => {
    expect(queryLibrary(data, {}).counts).toEqual({ all: 5, reading: 2, new: 2, finished: 1, c1: 2 })
  })
  it('status tabs keep series folders but only with matching volumes', () => {
    expect(titles(queryLibrary(data, { tab: 'finished' }))).toEqual(['Harbor Vol 1'])
    expect(titles(queryLibrary(data, { tab: 'new' }))).toEqual(['Café Notes', 'Harbor Vol 2'])
  })
  it('a collection tab shows its books', () => {
    expect(titles(queryLibrary(data, { tab: 'c1' }))).toEqual(['Café Notes', 'Harbor Vol 2'])
  })
  it('type chips combine (any of)', () => {
    expect(titles(queryLibrary(data, { types: ['novel', 'document'] }))).toEqual(['Café Notes', 'Dracula'])
  })
  it('search looks at title, author, series and tags, ignoring case and accents', () => {
    expect(titles(queryLibrary(data, { search: 'stoker' }))).toEqual(['Dracula'])
    expect(titles(queryLibrary(data, { search: 'HORROR' }))).toEqual(['Dracula'])
    expect(titles(queryLibrary(data, { search: 'cafe' }))).toEqual(['Café Notes'])
    expect(titles(queryLibrary(data, { search: 'harbor' }))).toEqual(['[Harbor: Harbor Vol 1, Harbor Vol 2]'])
    expect(titles(queryLibrary(data, { search: 'sci fi' }))).toEqual(['Iron Comet'])
  })
  it('sorts by recently read and by title', () => {
    expect(titles(queryLibrary(data, { sort: 'read' }))).toEqual(['Dracula', 'Iron Comet', '[Harbor: Harbor Vol 1, Harbor Vol 2]', 'Café Notes'])
    expect(titles(queryLibrary(data, { sort: 'title' }))).toEqual(['Café Notes', 'Dracula', '[Harbor: Harbor Vol 1, Harbor Vol 2]', 'Iron Comet'])
  })
  it('deleted books and their collection items are ignored', () => {
    const r = queryLibrary({ ...data, books: data.books.filter((b) => b !== pdf) }, { tab: 'c1' })
    expect(titles(r)).toEqual(['Harbor Vol 2'])
    expect(r.counts.c1).toBe(1)
  })
})
