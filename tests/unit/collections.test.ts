import { describe, it, expect } from 'vitest'
import { createCollection, renameCollection, recolorCollection, reorderCollections, deleteCollection, setMembership, addBooksTo, COLLECTION_COLOURS, liveCollections } from '../../src/library/collections'
import { deleteBook } from '../../src/library/editBook'
import type { CollectionItemRecord, CollectionRecord } from '../../src/library/query'
import { memFiles, memRecords } from './fakes'

const now = (() => { let t = 100; return () => ++t })()

describe('collections', () => {
  it('creates with a trimmed name, a colour and the next order', async () => {
    const r = memRecords()
    const a = await createCollection(r, '  Want to read ', undefined, now)
    const b = await createCollection(r, 'Book club', '#c678dd', now)
    expect(a).toMatchObject({ name: 'Want to read', order: 0 }); expect(COLLECTION_COLOURS).toContain(a.color)
    expect(b).toMatchObject({ name: 'Book club', color: '#c678dd', order: 1 })
  })
  it('refuses empty or duplicate names (ignoring case)', async () => {
    const r = memRecords()
    await createCollection(r, 'Fantasy', undefined, now)
    await expect(createCollection(r, ' ', undefined, now)).rejects.toThrow(/name/i)
    await expect(createCollection(r, 'fantasy', undefined, now)).rejects.toThrow(/already/i)
  })
  it('renames, recolours and reorders', async () => {
    const r = memRecords()
    const a = await createCollection(r, 'A', undefined, now), b = await createCollection(r, 'B', undefined, now), c = await createCollection(r, 'C', undefined, now)
    await renameCollection(r, a.id, 'Alpha', now)
    await recolorCollection(r, b.id, '#98c379', now)
    await reorderCollections(r, [c.id, a.id, b.id], now)
    const list = await liveCollections(r)
    expect(list.map((x) => `${x.name}:${x.order}`)).toEqual(['C:0', 'Alpha:1', 'B:2'])
    expect(list.find((x) => x.id === b.id)!.color).toBe('#98c379')
  })
  it('adding and removing books are separate records (safe to sync)', async () => {
    const r = memRecords()
    const a = await createCollection(r, 'A', undefined, now)
    await addBooksTo(r, a.id, ['b1', 'b2'], now)
    await setMembership(r, a.id, 'b1', false, now)
    const items = await r.list<CollectionItemRecord>('collectionItems')
    expect(items.map((i) => i.id)).toEqual([`${a.id}:b2`])
  })
  it('deleting a collection keeps the books but removes their membership', async () => {
    const r = memRecords()
    const a = await createCollection(r, 'A', undefined, now)
    await addBooksTo(r, a.id, ['b1'], now)
    await deleteCollection(r, a.id, now)
    expect(await r.list<CollectionRecord>('collections')).toHaveLength(0)
    expect(await r.list('collectionItems')).toHaveLength(0)
  })
  it('deleting a book removes it from every collection', async () => {
    const r = memRecords(), f = memFiles()
    const a = await createCollection(r, 'A', undefined, now)
    await r.put('books', { id: 'b1', updatedAt: 1 })
    await addBooksTo(r, a.id, ['b1'], now)
    await deleteBook(r, f, 'b1')
    expect(await r.list('collectionItems')).toHaveLength(0)
  })
  it('re-adding a book always beats its own tombstone, even within the same millisecond', async () => {
    const r = memRecords(); const fixed = () => 500
    const c = await createCollection(r, 'Same ms', undefined, fixed)
    await setMembership(r, c.id, 'b1', true, fixed)
    await setMembership(r, c.id, 'b1', false, fixed)
    const tomb = (await r.get<CollectionItemRecord>('collectionItems', `${c.id}:b1`))!
    await setMembership(r, c.id, 'b1', true, fixed)
    const live = (await r.get<CollectionItemRecord>('collectionItems', `${c.id}:b1`))!
    expect(live.deleted).toBeFalsy()
    expect(live.updatedAt).toBeGreaterThan(tomb.updatedAt)
  })
  it('reordering writes only the collections whose place changed', async () => {
    const r = memRecords()
    const a = await createCollection(r, 'A', undefined, now), b = await createCollection(r, 'B', undefined, now), c = await createCollection(r, 'C', undefined, now)
    const before = (await r.get<CollectionRecord>('collections', a.id))!.updatedAt
    await reorderCollections(r, [a.id, c.id, b.id], now)
    expect((await r.get<CollectionRecord>('collections', a.id))!.updatedAt).toBe(before) // A stayed first: untouched, so a rename elsewhere still wins
    expect((await r.get<CollectionRecord>('collections', c.id))!.order).toBe(1)
  })
})
