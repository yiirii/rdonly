import type { BaseRecord } from '../storage/types'
import { wins } from './merge'
import type { Cursor, Remote } from './remote'

/** An in-memory cloud with its own clock, for tests and the #debug e2e hook. */
export function memoryRemote() {
  const docs = new Map<string, { rec: BaseRecord; at: number }>()
  const watchers = new Set<{ uid: string; col: string; on: (r: BaseRecord[], c: Cursor) => void }>()
  const uids = new Set<string>()
  let clock = 0
  const key = (uid: string, col: string, id: string) => `${uid}/${col}/${id}`
  const fail = () => { if (r.offline) { const e = new Error('offline'); (e as { code?: string }).code = 'unavailable'; throw e } }
  const r = {
    offline: false, writes: 0, pulled: 0,
    async pushIfNewer(uid, col, rec) {
      fail()
      const cur = docs.get(key(uid, col, rec.id))
      if (cur && !wins(rec, cur.rec)) return false
      const at = ++clock
      docs.set(key(uid, col, rec.id), { rec: structuredClone(rec), at }); r.writes++; uids.add(uid)
      for (const w of watchers) if (w.uid === uid && w.col === col) queueMicrotask(() => w.on([structuredClone(rec)], at))
      return true
    },
    async pullSince(uid, col, cursor) {
      fail()
      let max = cursor; const recs: BaseRecord[] = []
      for (const [k, d] of docs) if (k.startsWith(`${uid}/${col}/`) && d.at > cursor) { recs.push(structuredClone(d.rec)); max = Math.max(max, d.at) }
      r.pulled += recs.length
      return { recs, cursor: max }
    },
    watch(uid, col, _cursor, on) { const w = { uid, col, on }; watchers.add(w); return () => watchers.delete(w) },
    peek: (uid: string, col: string, id: string) => docs.get(key(uid, col, id))?.rec as (BaseRecord & Record<string, unknown>) | undefined,
    seed(uid: string, col: string, rec: BaseRecord) { docs.set(key(uid, col, rec.id), { rec, at: ++clock }) },
    uidsWritten: () => [...uids].sort(),
  } satisfies Remote & Record<string, unknown>
  return r
}
