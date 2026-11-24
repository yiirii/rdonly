import { createIdbRecordStore } from './idbRecords'
import { bridge, type RecordStore } from './types'
import { syncedRecords } from '../sync/outbox'

let idb: RecordStore | undefined
let synced: RecordStore | undefined
let syncedBase: RecordStore | undefined
let onLocalWrite: (() => void) | undefined

/** The device's own store, untouched by sync bookkeeping (sync writes remote changes here). */
export function getBaseRecordStore(): RecordStore {
  const b = bridge()
  if (b?.records) return b.records
  return (idb ??= createIdbRecordStore())
}

/** What the app uses: writes locally as always, and queues them to go up when sync is on. */
export function getRecordStore(): RecordStore {
  const base = getBaseRecordStore()
  if (!synced || syncedBase !== base) { syncedBase = base; synced = syncedRecords(base, () => onLocalWrite?.()) }
  return synced
}
export function setLocalWriteHook(fn: () => void) { onLocalWrite = fn }
