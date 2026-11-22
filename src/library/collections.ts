import type { RecordStore } from '../storage/types'
import type { CollectionItemRecord, CollectionRecord } from './query'

/** Flat, muted dot colours for collection tabs. */
export const COLLECTION_COLOURS = ['#e5c07b', '#c678dd', '#98c379', '#56b6c2', '#e06c75', '#d19a66', '#7aa2f7', '#a9a49a']

const uid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 16)

export async function liveCollections(r: RecordStore) {
  return (await r.list<CollectionRecord>('collections')).sort((a, z) => a.order - z.order || a.name.localeCompare(z.name))
}

async function checkName(r: RecordStore, name: string, except?: string) {
  const n = name.trim().replace(/\s+/g, ' ')
  if (!n) throw new Error('A collection needs a name')
  if ((await liveCollections(r)).some((c) => c.id !== except && c.name.toLowerCase() === n.toLowerCase())) throw new Error(`“${n}” already exists`)
  return n
}

export async function createCollection(r: RecordStore, name: string, color?: string, now = Date.now): Promise<CollectionRecord> {
  const n = await checkName(r, name)
  const list = await liveCollections(r)
  const c: CollectionRecord = { id: uid(), name: n, color: color ?? COLLECTION_COLOURS[list.length % COLLECTION_COLOURS.length], order: list.length ? Math.max(...list.map((x) => x.order)) + 1 : 0, updatedAt: now() }
  await r.put('collections', c)
  return c
}

async function patch(r: RecordStore, id: string, p: Partial<CollectionRecord>, now: () => number) {
  const c = await r.get<CollectionRecord>('collections', id)
  if (!c || c.deleted) throw new Error('Collection not found')
  await r.put('collections', { ...c, ...p, updatedAt: Math.max(now(), c.updatedAt + 1) })
}
export async function renameCollection(r: RecordStore, id: string, name: string, now = Date.now) { await patch(r, id, { name: await checkName(r, name, id) }, now) }
export async function recolorCollection(r: RecordStore, id: string, color: string, now = Date.now) { await patch(r, id, { color }, now) }
export async function reorderCollections(r: RecordStore, ids: string[], now = Date.now) {
  for (const [i, id] of ids.entries()) await patch(r, id, { order: i }, now)
}

export async function deleteCollection(r: RecordStore, id: string, now = Date.now) {
  for (const it of await r.list<CollectionItemRecord>('collectionItems')) if (it.collectionId === id) await r.remove('collectionItems', it.id)
  await r.remove('collections', id)
  void now
}

export async function setMembership(r: RecordStore, collectionId: string, bookId: string, member: boolean, now = Date.now) {
  const id = `${collectionId}:${bookId}`
  if (member) await r.put<CollectionItemRecord>('collectionItems', { id, collectionId, bookId, updatedAt: now() })
  else if (await r.get('collectionItems', id)) await r.remove('collectionItems', id)
}
export async function addBooksTo(r: RecordStore, collectionId: string, bookIds: string[], now = Date.now) {
  for (const b of bookIds) await setMembership(r, collectionId, b, true, now)
}
