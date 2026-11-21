import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createIdbRecordStore } from '../../src/storage/idbRecords'
import { getRecordStore } from '../../src/storage/select'
import type { BaseRecord } from '../../src/storage/types'

interface Book extends BaseRecord { title: string }

let dbn = 0
const fresh = () => createIdbRecordStore(`test-${++dbn}`)

describe('IndexedDB record store', () => {
  it('round-trips a record', async () => {
    const s = fresh()
    await s.put<Book>('books', { id: 'a', updatedAt: 1, title: 'Dune' })
    expect(await s.get<Book>('books', 'a')).toEqual({ id: 'a', updatedAt: 1, title: 'Dune' })
  })
  it('returns undefined for unknown ids', async () => {
    expect(await fresh().get('books', 'nope')).toBeUndefined()
  })
  it('remove writes a tombstone with a newer updatedAt', async () => {
    const s = fresh()
    await s.put<Book>('books', { id: 'a', updatedAt: 1, title: 'Dune' })
    await s.remove('books', 'a')
    const r = await s.get<Book>('books', 'a')
    expect(r?.deleted).toBe(true)
    expect(r!.updatedAt).toBeGreaterThan(1)
  })
  it('list hides tombstones unless asked', async () => {
    const s = fresh()
    await s.put<Book>('books', { id: 'a', updatedAt: 1, title: 'A' })
    await s.put<Book>('books', { id: 'b', updatedAt: 1, title: 'B' })
    await s.remove('books', 'b')
    expect((await s.list<Book>('books')).map((r) => r.id)).toEqual(['a'])
    expect((await s.list<Book>('books', { includeDeleted: true })).map((r) => r.id).sort()).toEqual(['a', 'b'])
  })
})

describe('getRecordStore', () => {
  const w = window as unknown as { rdonly?: unknown }
  afterEach(() => { delete w.rdonly })
  it('uses the Electron bridge when present', async () => {
    const calls: string[] = []
    w.rdonly = { records: {
      get: async () => { calls.push('get'); return undefined },
      put: async () => {}, list: async () => [], remove: async () => {},
    } }
    await getRecordStore().get('books', 'x')
    expect(calls).toEqual(['get'])
  })
  it('falls back to IndexedDB in a plain browser', async () => {
    const s = getRecordStore()
    await s.put('books', { id: 'z', updatedAt: 5 })
    expect(await s.get('books', 'z')).toEqual({ id: 'z', updatedAt: 5 })
  })
})
