import { createIdbRecordStore } from './idbRecords'
import { bridge, type RecordStore } from './types'

let idb: RecordStore | undefined

export function getRecordStore(): RecordStore {
  const b = bridge()
  if (b?.records) return b.records
  return (idb ??= createIdbRecordStore())
}
