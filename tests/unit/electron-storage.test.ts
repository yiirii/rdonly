// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDiskStorage } from '../../electron/storage'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'rdonly-')) })

describe('disk record store', () => {
  it('round-trips and survives a fresh instance', async () => {
    await createDiskStorage(dir).records.put('books', { id: 'a', updatedAt: 1 })
    expect(await createDiskStorage(dir).records.get('books', 'a')).toEqual({ id: 'a', updatedAt: 1 })
  })
  it('tombstones on remove and hides them from list', async () => {
    const s = createDiskStorage(dir)
    await s.records.put('books', { id: 'a', updatedAt: 1 })
    await s.records.put('books', { id: 'b', updatedAt: 1 })
    await s.records.remove('books', 'a')
    expect((await s.records.list('books')).map((r) => r.id)).toEqual(['b'])
    expect((await s.records.get('books', 'a'))?.deleted).toBe(true)
  })
  it('ignores a stray temp file from an interrupted write', async () => {
    const s = createDiskStorage(dir)
    await s.records.put('books', { id: 'a', updatedAt: 1 })
    writeFileSync(join(dir, 'records', 'books.json.tmp'), '{"half":')
    expect(await createDiskStorage(dir).records.get('books', 'a')).toEqual({ id: 'a', updatedAt: 1 })
  })
  it('writes atomically (no temp file left behind)', async () => {
    const s = createDiskStorage(dir)
    await s.records.put('books', { id: 'a', updatedAt: 1 })
    expect(readdirSync(join(dir, 'records'))).toEqual(['books.json'])
  })
  it('rejects collection names that could escape the folder', async () => {
    await expect(createDiskStorage(dir).records.put('../evil', { id: 'a', updatedAt: 1 })).rejects.toThrow()
  })
})

describe('disk file store', () => {
  it('stores books as books/{id}.{ext}', async () => {
    const s = createDiskStorage(dir)
    await s.files.put('abc', 'epub', new Uint8Array([1, 2]))
    expect(existsSync(join(dir, 'books', 'abc.epub'))).toBe(true)
    expect(Array.from((await s.files.get('abc'))!)).toEqual([1, 2])
    expect(await s.files.has('abc')).toBe(true)
    expect((await s.files.usage()).usedBytes).toBe(2)
    await s.files.remove('abc')
    expect(await s.files.has('abc')).toBe(false)
  })
  it('rejects ids that are not plain hashes', async () => {
    await expect(createDiskStorage(dir).files.put('../x', 'epub', new Uint8Array())).rejects.toThrow()
  })
})

describe('disk storage failure handling', () => {
  it('a failed record save leaves no record behind', async () => {
    const s = createDiskStorage(dir)
    await s.records.put('books', { id: 'a', updatedAt: 1 })
    mkdirSync(join(dir, 'records', 'books.json.tmp')) // makes the next write fail
    await expect(s.records.put('books', { id: 'b', updatedAt: 1 })).rejects.toThrow()
    expect(await s.records.get('books', 'b')).toBeUndefined()
    expect((await s.records.list('books')).map((r) => r.id)).toEqual(['a'])
  })
  it('a leftover partial file does not count as the book', async () => {
    const s = createDiskStorage(dir)
    mkdirSync(join(dir, 'books'), { recursive: true })
    writeFileSync(join(dir, 'books', 'abc.cbz.tmp'), 'half')
    expect(await s.files.has('abc')).toBe(false)
    expect(await s.files.get('abc')).toBeUndefined()
  })
  it('a failed book write cleans up its partial file', async () => {
    const s = createDiskStorage(dir)
    mkdirSync(join(dir, 'books', 'abc.cbz'), { recursive: true }) // rename onto a directory fails
    await expect(s.files.put('abc', 'cbz', new Uint8Array([1]))).rejects.toThrow()
    expect(existsSync(join(dir, 'books', 'abc.cbz.tmp'))).toBe(false)
  })
})
