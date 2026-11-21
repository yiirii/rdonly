import { describe, it, expect } from 'vitest'
import { updateBook, deleteBook } from '../../src/library/editBook'
import type { BookRecord } from '../../src/library/types'
import { memFiles, memRecords } from './fakes'

const book = (): BookRecord => ({ id: 'b1', updatedAt: 100, title: 'Old', format: 'cbz', tag: 'manga', fileName: 'x.cbz', fileSize: 3, addedAt: 50 })

describe('updateBook', () => {
  it('saves changes with a newer updatedAt and a trimmed title', async () => {
    const r = memRecords(); await r.put('books', book())
    const out = await updateBook(r, 'b1', { title: '  New Title  ', series: 'Saga', volume: 2 }, () => 500)
    expect(out).toMatchObject({ title: 'New Title', series: 'Saga', volume: 2, updatedAt: 500 })
    expect(await r.get('books', 'b1')).toMatchObject({ title: 'New Title' })
  })
  it('refuses an empty title', async () => {
    const r = memRecords(); await r.put('books', book())
    await expect(updateBook(r, 'b1', { title: '   ' })).rejects.toThrow(/title/i)
  })
  it('clearing a field removes it', async () => {
    const r = memRecords(); await r.put('books', { ...book(), author: 'A', series: 'S' })
    const out = await updateBook(r, 'b1', { author: '', series: undefined })
    expect(out.author).toBeUndefined(); expect(out.series).toBeUndefined()
  })
  it('changing the type resets a per-book reading mode', async () => {
    const r = memRecords(); await r.put('books', { ...book(), modeOverride: 'paged-ltr' })
    const out = await updateBook(r, 'b1', { tag: 'webtoon' })
    expect(out.tag).toBe('webtoon'); expect(out.modeOverride).toBeUndefined()
  })
  it('updatedAt always moves forward even if the clock is behind', async () => {
    const r = memRecords(); await r.put('books', book())
    expect((await updateBook(r, 'b1', { title: 'X' }, () => 10)).updatedAt).toBe(101)
  })
})

describe('deleteBook', () => {
  it('removes the file and leaves tombstones for the book and its progress', async () => {
    const r = memRecords(), f = memFiles()
    await r.put('books', book()); await r.put('progress', { id: 'b1', updatedAt: 1 }); await f.put('b1', 'cbz', new Uint8Array([1]))
    await deleteBook(r, f, 'b1')
    expect(await f.has('b1')).toBe(false)
    expect((await r.get('books', 'b1'))?.deleted).toBe(true)
    expect((await r.get('progress', 'b1'))?.deleted).toBe(true)
    expect(await r.list('books')).toHaveLength(0)
  })
})
