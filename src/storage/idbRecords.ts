import { openDB, type IDBPDatabase } from 'idb'
import { tombstoneTime, type BaseRecord, type RecordStore } from './types'

interface Row { col: string; id: string; rec: BaseRecord }

/** All collections live in one object store keyed by [col, id], so new collections need no schema migration. */
export function createIdbRecordStore(name = 'rdonly'): RecordStore {
  let db: Promise<IDBPDatabase> | undefined
  const open = () => (db ??= openDB(name, 1, {
    upgrade(d) {
      const s = d.createObjectStore('records', { keyPath: ['col', 'id'] })
      s.createIndex('col', 'col')
    },
  }))
  const store: RecordStore = {
    async get<T extends BaseRecord>(col: string, id: string) {
      const row = (await (await open()).get('records', [col, id])) as Row | undefined
      return row?.rec as T | undefined
    },
    async put(col, rec) {
      await (await open()).put('records', { col, id: rec.id, rec } satisfies Row)
    },
    async list<T extends BaseRecord>(col: string, opts?: { includeDeleted?: boolean }) {
      const rows = (await (await open()).getAllFromIndex('records', 'col', col)) as Row[]
      const recs = rows.map((r) => r.rec as T)
      return opts?.includeDeleted ? recs : recs.filter((r) => !r.deleted)
    },
    async remove(col, id) {
      const prev = await store.get(col, id)
      await store.put(col, { ...(prev ?? { id }), id, deleted: true, updatedAt: tombstoneTime(prev?.updatedAt) })
    },
  }
  return store
}
