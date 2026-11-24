import type { BaseRecord } from '../storage/types'
import { authMessage, type SyncUser } from './auth'
import type { PushResult, Remote } from './remote'
import type { SyncBackend } from '../state/sync'

// #debug only: a backend that talks to a stand-in cloud the e2e test runner exposes as window functions.
type W = { cloudAuth(kind: string, e: string, p: string): Promise<{ uid?: string; email?: string; error?: string }>; cloudCall(op: string, uid: string, col: string, arg: unknown): Promise<{ ok?: unknown; error?: string }> }
const USER_KEY = 'rdonly.fakeUser'

export function fakeBackend(): SyncBackend {
  const w = window as unknown as W
  const fns = new Set<(u: SyncUser | null) => void>()
  let user: SyncUser | null = null
  try { user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') } catch { /* none */ }
  const setUser = (u: SyncUser | null) => { user = u; try { localStorage.setItem(USER_KEY, JSON.stringify(u)) } catch { /* ignore */ } for (const f of fns) f(u) }
  const auth = async (kind: string, e: string, p: string) => {
    const r = await w.cloudAuth(kind, e, p)
    if (r.error) throw new Error(authMessage({ code: r.error }))
    setUser({ uid: r.uid!, email: r.email! }); return user!
  }
  const call = async <T>(op: string, uid: string, col: string, arg: unknown) => {
    const r = await w.cloudCall(op, uid, col, arg)
    if (r.error) throw Object.assign(new Error(r.error), { code: r.error })
    return r.ok as T
  }
  const remote: Remote = {
    pushIfNewer: (uid, col, rec) => call<PushResult>('push', uid, col, rec),
    pullSince: (uid, col, cursor) => call<{ recs: BaseRecord[]; cursor: number }>('pull', uid, col, cursor),
    watch(uid, col, cursor, on, onError) { // the stand-in cloud can't call into the page, so it's polled
      let c = cursor, stop = false
      const loop = async () => {
        while (!stop) {
          try { const r = await call<{ recs: BaseRecord[]; cursor: number }>('pull', uid, col, c); if (r.recs.length) { c = r.cursor; on(r.recs, r.cursor) } } catch (e) { onError?.(e) }
          await new Promise((res) => setTimeout(res, 250))
        }
      }
      void loop(); return () => { stop = true }
    },
  }
  return {
    remote,
    auth: {
      signIn: (e, p) => auth('signIn', e, p), signUp: (e, p) => auth('signUp', e, p),
      async signOut() { setUser(null) }, async resetPassword() { /* nothing to send */ },
      onUser(fn) { fns.add(fn); queueMicrotask(() => fn(user)); return () => fns.delete(fn) },
    },
  }
}
