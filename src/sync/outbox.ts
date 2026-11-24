import type { BaseRecord, RecordStore } from '../storage/types'
import { wins } from './merge'

/** Collections that follow you between devices. Everything else stays local. */
export const SYNC_COLS = ['books', 'progress', 'collections', 'collectionItems', 'settings'] as const
export const OUTBOX = '_outbox'
export interface OutboxEntry extends BaseRecord { col: string; recId: string; stamp: string }

let n = 0
const stamp = () => `${Date.now().toString(36)}.${(n++).toString(36)}.${Math.random().toString(36).slice(2, 7)}`
const isSynced = (col: string) => (SYNC_COLS as readonly string[]).includes(col)

async function enqueue(local: RecordStore, col: string, recId: string) {
  await local.put<OutboxEntry>(OUTBOX, { id: `${col}/${recId}`, col, recId, stamp: stamp(), updatedAt: Date.now() })
}

/** A RecordStore that writes locally as before and remembers what changed, so it can be sent up later. */
export function syncedRecords(local: RecordStore, onWrite?: () => void): RecordStore {
  return {
    get: (c, id) => local.get(c, id),
    list: (c, o) => local.list(c, o),
    async put(col, rec) { await local.put(col, rec); if (isSynced(col)) { await enqueue(local, col, rec.id); onWrite?.() } },
    async remove(col, id) { await local.remove(col, id); if (isSynced(col)) { await enqueue(local, col, id); onWrite?.() } },
  }
}

/** Queue every existing record (used once per device+account, for data written before sync was on). */
export async function enqueueAll(local: RecordStore) {
  for (const col of SYNC_COLS) for (const r of await local.list(col, { includeDeleted: true })) await enqueue(local, col, r.id)
}

export const pendingOutbox = (local: RecordStore) => local.list<OutboxEntry>(OUTBOX)

/** Drop an outbox entry only if nobody re-queued the record while it was being sent. */
export async function settleOutbox(local: RecordStore, e: OutboxEntry) {
  const cur = await local.get<OutboxEntry>(OUTBOX, e.id)
  if (cur && !cur.deleted && cur.stamp === e.stamp) await local.remove(OUTBOX, e.id)
}

/** Write a record that came from the cloud, if it beats what's here. Never queued for upload. */
export async function applyRemote(local: RecordStore, col: string, rec: BaseRecord): Promise<boolean> {
  const cur = await local.get(col, rec.id)
  if (!wins(rec, cur)) return false
  await local.put(col, rec)
  return true
}
