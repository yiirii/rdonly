import { describe, it, expect } from 'vitest'
import { groupLibrary, seriesKey } from '../../src/library/series'
import type { BookRecord } from '../../src/library/types'

let n = 0
const b = (title: string, series?: string, addedAt = ++n): BookRecord =>
  ({ id: `id${++n}`, updatedAt: 1, title, series, format: 'cbz', tag: 'manga', fileName: 'x', fileSize: 1, addedAt })

describe('seriesKey', () => {
  it('ignores capitals and extra spaces', () => {
    expect(seriesKey('  One   Piece ')).toBe(seriesKey('one piece'))
  })
})

describe('groupLibrary', () => {
  it('puts books with the same series into one folder', () => {
    const items = groupLibrary([b('A Vol 1', 'Saga'), b('Loose'), b('A Vol 2', 'saga ')])
    const folders = items.filter((i) => i.kind === 'series')
    expect(folders).toHaveLength(1)
    expect(folders[0].kind === 'series' && folders[0].books.map((x) => x.title)).toEqual(['A Vol 1', 'A Vol 2'])
    expect(items.filter((i) => i.kind === 'book')).toHaveLength(1)
  })
  it('sorts the books inside alphabetically, numbers in natural order', () => {
    const [f] = groupLibrary([b('Saga Vol 10', 'S'), b('Saga Vol 2', 'S'), b('Saga Vol 1', 'S')])
    expect(f.kind === 'series' && f.books.map((x) => x.title)).toEqual(['Saga Vol 1', 'Saga Vol 2', 'Saga Vol 10'])
  })
  it('a single book with a series stays a normal book', () => {
    const items = groupLibrary([b('Only', 'Lonely')])
    expect(items).toEqual([{ kind: 'book', book: expect.objectContaining({ title: 'Only' }) }])
  })
  it('keeps the library order, with a folder placed where its newest book would be', () => {
    const items = groupLibrary([b('New', undefined, 300), b('S2', 'S', 200), b('Old', undefined, 100), b('S1', 'S', 50)])
    expect(items.map((i) => (i.kind === 'book' ? i.book.title : `[${i.name}]`))).toEqual(['New', '[S]', 'Old'])
  })
})

describe('folder name', () => {
  it('uses the most common spelling, preferring capitals on a tie', () => {
    const [f] = groupLibrary([b('x1', 'heroes'), b('x2', 'Heroes')])
    expect(f.kind === 'series' && f.name).toBe('Heroes')
    const [g] = groupLibrary([b('y1', 'the saga'), b('y2', 'the saga'), b('y3', 'The Saga')])
    expect(g.kind === 'series' && g.name).toBe('the saga')
  })
})
