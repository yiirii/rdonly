import { describe, it, expect, beforeEach } from 'vitest'
import { importFiles } from '../../src/library/importBooks'
import type { BookRecord } from '../../src/library/types'
import { fixture } from './fixtures'
import { memFiles, memRecords } from './fakes'

let records: ReturnType<typeof memRecords>, files: ReturnType<typeof memFiles>
const deps = () => ({ records, files, now: () => 1000, thumb: async () => 'data:image/webp;base64,AA' })
const f = (fixtureName: string, name = fixtureName) => ({ name, bytes: fixture(fixtureName) })

beforeEach(() => { records = memRecords(); files = memFiles() })

describe('importFiles', () => {
  it('adds a new book with its metadata', async () => {
    const [r] = await importFiles([f('novel.epub')], deps())
    expect(r.status).toBe('added')
    const b = (await records.get<BookRecord>('books', r.bookId!))!
    expect(b).toMatchObject({ title: 'Test Novel', author: 'A. Writer', series: 'Test Saga', volume: 2, format: 'epub', tag: 'novel',
      fileName: 'novel.epub', fileSize: fixture('novel.epub').length, addedAt: 1000, updatedAt: 1000, coverThumb: 'data:image/webp;base64,AA' })
    expect(b.id).toMatch(/^[0-9a-f]{64}$/)
    expect(await files.has(b.id)).toBe(true)
  })

  it('reports the same file under a new name as a duplicate, keeping one book', async () => {
    await importFiles([f('novel.epub')], deps())
    const [r] = await importFiles([f('novel.epub', 'renamed copy.epub')], deps())
    expect(r.status).toBe('duplicate')
    expect(await records.list('books')).toHaveLength(1)
  })

  it('relinks a book whose file went missing', async () => {
    const [a] = await importFiles([f('manga.cbz')], deps())
    await files.remove(a.bookId!)
    const [r] = await importFiles([f('manga.cbz')], deps())
    expect(r.status).toBe('relinked')
    expect(await files.has(a.bookId!)).toBe(true)
  })

  it('re-adds a deleted book', async () => {
    const [a] = await importFiles([f('novel.epub')], deps())
    await records.remove('books', a.bookId!)
    await files.remove(a.bookId!)
    const [r] = await importFiles([f('novel.epub')], { ...deps(), now: () => 5000 })
    expect(r.status).toBe('added')
    const b = (await records.get<BookRecord>('books', a.bookId!))!
    expect(b.deleted).toBeUndefined()
    expect(b.updatedAt).toBe(5000)
  })

  it('keeps going past bad files in a batch', async () => {
    const res = await importFiles([f('novel.epub'), f('book.mobi'), f('broken.cbz'), f('empty.epub'), f('manga.cbz')], deps())
    expect(res.map((r) => r.status)).toEqual(['added', 'unsupported', 'error', 'unsupported', 'added'])
    expect(await records.list('books')).toHaveLength(2)
  })

  it('rolls back the file when the record cannot be saved', async () => {
    records.failPut = true
    const [r] = await importFiles([f('novel.epub')], deps())
    expect(r.status).toBe('error')
    expect(r.message).toMatch(/storage/i)
    expect((await files.usage()).usedBytes).toBe(0)
  })

  it('reports a full disk when the file cannot be saved', async () => {
    files.failPut = true
    const [r] = await importFiles([f('novel.epub')], deps())
    expect(r.status).toBe('error')
    expect(await records.list('books')).toHaveLength(0)
  })

  it('falls back to a cleaned filename when the book has no title', async () => {
    const [r] = await importFiles([f('bare.epub', 'My_Book.epub')], deps())
    expect((await records.get<BookRecord>('books', r.bookId!))!.title).toBe('My Book')
  })

  it('still imports when the cover thumbnail fails', async () => {
    const [r] = await importFiles([f('novel.epub')], { ...deps(), thumb: async () => { throw new Error('canvas') } })
    expect(r.status).toBe('added')
    expect((await records.get<BookRecord>('books', r.bookId!))!.coverThumb).toBeUndefined()
  })
})
