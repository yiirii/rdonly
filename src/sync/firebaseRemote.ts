import type { Firestore, Timestamp } from 'firebase/firestore'
import type { BaseRecord } from '../storage/types'
import { wins } from './merge'
import type { Remote } from './remote'

/**
 * Records live at users/{uid}/{col}/{id}. Each doc also carries `_at`, the server's time of the write,
 * which orders the change stream — device clocks never decide what gets downloaded.
 * Pulls overlap the last minute (merging is idempotent) so a write that committed slightly late is never missed.
 */
const OVERLAP_MS = 60_000

export async function firebaseRemote(db: Firestore): Promise<Remote> {
  const f = await import('firebase/firestore')
  const colRef = (uid: string, col: string) => f.collection(db, 'users', uid, col)
  const strip = (d: Record<string, unknown>) => { const { _at, ...rec } = d; void _at; return rec as unknown as BaseRecord }
  const ms = (t: unknown) => (t && typeof (t as Timestamp).toMillis === 'function' ? (t as Timestamp).toMillis() : 0)
  const since = (uid: string, col: string, cursor: number) =>
    f.query(colRef(uid, col), f.where('_at', '>=', f.Timestamp.fromMillis(Math.max(0, cursor - OVERLAP_MS))), f.orderBy('_at'))

  return {
    async pushIfNewer(uid, col, rec) {
      const ref = f.doc(db, 'users', uid, col, rec.id)
      return f.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (snap.exists() && !wins(rec, strip(snap.data()))) return false
        tx.set(ref, { ...rec, _at: f.serverTimestamp() })
        return true
      })
    },
    async pullSince(uid, col, cursor) {
      const snap = await f.getDocs(since(uid, col, cursor))
      let max = cursor
      const recs = snap.docs.map((d) => { const data = d.data(); max = Math.max(max, ms(data._at)); return strip(data) })
      return { recs, cursor: max }
    },
    watch(uid, col, cursor, on, onError) {
      return f.onSnapshot(since(uid, col, cursor), (snap) => {
        let max = cursor; const recs: BaseRecord[] = []
        for (const ch of snap.docChanges()) {
          if (ch.type === 'removed') continue
          const data = ch.doc.data({ serverTimestamps: 'none' })
          if (!data._at) continue // our own write, not yet stamped by the server; it comes back stamped
          max = Math.max(max, ms(data._at)); recs.push(strip(data))
        }
        if (recs.length) on(recs, max)
      }, (e) => onError?.(e))
    },
  }
}
