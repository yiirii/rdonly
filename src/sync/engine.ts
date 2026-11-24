import type { BaseRecord, RecordStore } from '../storage/types'
import { applyRemote, enqueueAll, pendingOutbox, settleOutbox, SYNC_COLS } from './outbox'
import { isOffline, type Cursor, type Remote, type Unsubscribe } from './remote'

export interface CursorStore { get(uid: string, key: string): number | undefined; set(uid: string, key: string, v: number): void }
export const memoryCursors = (): CursorStore => { const m = new Map<string, number>(); return { get: (u, k) => m.get(`${u}/${k}`), set: (u, k, v) => void m.set(`${u}/${k}`, v) } }
export const localCursors = (): CursorStore => ({
  get(u, k) { try { const v = localStorage.getItem(`rdonly.sync.${u}.${k}`); return v === null ? undefined : Number(v) } catch { return undefined } },
  set(u, k, v) { try { localStorage.setItem(`rdonly.sync.${u}.${k}`, String(v)) } catch { /* private mode: we'll just pull more next time */ } },
})

export type SyncState = 'off' | 'syncing' | 'idle' | 'offline' | 'error'
export interface SyncStatus { state: SyncState; pending: number; lastSyncAt?: number; error?: string }

export interface SyncEngine {
  start(): Promise<void>
  stop(): void
  /** Pull, then push the outbox. Safe to call any time; overlapping calls share one run. */
  syncNow(): Promise<void>
  /** A local write happened: push soon. */
  nudge(): void
  status(): SyncStatus
  onChange(fn: (cols: Set<string>) => void): Unsubscribe
  onStatus(fn: (s: SyncStatus) => void): Unsubscribe
}

export function createSyncEngine(o: { local: RecordStore; remote: Remote; uid: string; cursors: CursorStore; pushDelayMs?: number; retryMs?: number; cols?: readonly string[] }): SyncEngine {
  const { local, remote, uid, cursors } = o
  const cols = o.cols ?? SYNC_COLS
  let alive = false
  let status: SyncStatus = { state: 'off', pending: 0 }
  const changeFns = new Set<(c: Set<string>) => void>(), statusFns = new Set<(s: SyncStatus) => void>()
  const unsubs: Unsubscribe[] = []
  let running: Promise<void> | null = null, again = false
  let pushTimer: ReturnType<typeof setTimeout> | undefined, retryTimer: ReturnType<typeof setTimeout> | undefined

  const setStatus = (p: Partial<SyncStatus>) => { status = { ...status, ...p }; for (const f of statusFns) f(status) }
  const changed = (c: Set<string>) => { if (c.size) for (const f of changeFns) f(c) }
  const cursorOf = (col: string) => cursors.get(uid, col) ?? 0
  const advance = (col: string, c: Cursor) => { if (c > cursorOf(col)) cursors.set(uid, col, c) }

  async function apply(col: string, recs: BaseRecord[]) {
    let any = false
    for (const r of recs) { if (!alive) return false; if (await applyRemote(local, col, r)) any = true }
    return any
  }

  async function once() {
    setStatus({ state: 'syncing' })
    try {
      // Data written on this device before sync was switched on (or under another account) goes up once.
      if (!cursors.get(uid, 'seeded')) await enqueueAll(local)
      const touched = new Set<string>()
      for (const col of cols) {
        if (!alive) return
        const { recs, cursor } = await remote.pullSince(uid, col, cursorOf(col))
        if (!alive) return
        if (await apply(col, recs)) touched.add(col)
        advance(col, cursor)
      }
      changed(touched)
      for (const e of await pendingOutbox(local)) {
        if (!alive) return
        const rec = await local.get(e.col, e.recId)
        if (rec && alive) await remote.pushIfNewer(uid, e.col, rec)
        if (!alive) return
        await settleOutbox(local, e)
      }
      cursors.set(uid, 'seeded', 1)
      setStatus({ state: 'idle', pending: (await pendingOutbox(local)).length, lastSyncAt: Date.now(), error: undefined })
    } catch (e) {
      if (!alive) return
      const pending = (await pendingOutbox(local)).length
      if (isOffline(e)) setStatus({ state: 'offline', pending })
      else setStatus({ state: 'error', pending, error: plain(e) })
      clearTimeout(retryTimer); retryTimer = setTimeout(() => { if (alive) void engine.syncNow() }, o.retryMs ?? 15_000)
    }
  }

  const engine: SyncEngine = {
    async start() {
      if (alive) return
      alive = true
      setStatus({ state: 'syncing', pending: (await pendingOutbox(local)).length })
      await engine.syncNow()
      if (!alive) return
      for (const col of cols) {
        unsubs.push(remote.watch(uid, col, cursorOf(col), (recs, c) => {
          if (!alive) return
          void apply(col, recs).then((any) => { if (!alive) return; advance(col, c); if (any) changed(new Set([col])) })
        }, (e) => { if (alive && isOffline(e)) setStatus({ state: 'offline' }) }))
      }
    },
    stop() {
      alive = false
      clearTimeout(pushTimer); clearTimeout(retryTimer)
      for (const u of unsubs.splice(0)) u()
      setStatus({ state: 'off' })
    },
    syncNow() {
      if (!alive) return Promise.resolve()
      if (running) { again = true; return running }
      running = (async () => {
        do { again = false; await once() } while (again && alive)
      })().finally(() => { running = null })
      return running
    },
    nudge() {
      if (!alive) return
      clearTimeout(pushTimer)
      pushTimer = setTimeout(() => void engine.syncNow(), o.pushDelayMs ?? 800)
      void pendingOutbox(local).then((p) => alive && setStatus({ pending: p.length }))
    },
    status: () => status,
    onChange(fn) { changeFns.add(fn); return () => changeFns.delete(fn) },
    onStatus(fn) { statusFns.add(fn); return () => statusFns.delete(fn) },
  }
  return engine
}

/** Errors in plain words. */
export function plain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (/permission-denied/.test(code)) return 'The cloud refused this account’s data. Try signing out and in again.'
  if (/resource-exhausted|quota/.test(code)) return 'Today’s free sync allowance is used up. Sync resumes tomorrow; nothing is lost.'
  if (/unauthenticated/.test(code)) return 'You’ve been signed out. Sign in again to keep syncing.'
  return 'Sync hit a problem and will try again shortly.'
}
