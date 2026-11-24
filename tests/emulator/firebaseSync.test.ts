import { describe, it, expect, beforeAll } from 'vitest'
import { firebase } from '../../src/sync/firebase'
import { firebaseRemote } from '../../src/sync/firebaseRemote'
import { authApi } from '../../src/sync/auth'
import { syncedRecords } from '../../src/sync/outbox'
import { createSyncEngine, memoryCursors, type SyncEngine } from '../../src/sync/engine'
import type { BaseRecord } from '../../src/storage/types'
import { memRecords } from '../unit/fakes'

// The real Firebase SDK against the Auth + Firestore emulators, with the same rules Justin published.
type Rec = BaseRecord & { title?: string }
const emulators = { auth: 'http://127.0.0.1:9099', firestore: { host: '127.0.0.1', port: 8080 } }
const config = { apiKey: 'demo-key', authDomain: 'demo-rdonly.firebaseapp.com', projectId: 'demo-rdonly', storageBucket: '', messagingSenderId: '0', appId: 'demo' }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let n = 0

async function device(email: string, password = 'secret123', create = false) {
  const h = await firebase({ config, emulators, name: `dev${n++}` })
  const auth = await authApi(h.auth)
  const user = create ? await auth.signUp(email, password) : await auth.signIn(email, password)
  const remote = await firebaseRemote(h.db)
  const local = memRecords()
  let engine!: SyncEngine
  const store = syncedRecords(local, () => engine?.nudge())
  engine = createSyncEngine({ local, remote, uid: user.uid, cursors: memoryCursors(), pushDelayMs: 0 })
  return { h, auth, user, remote, local, store, engine }
}
async function until(fn: () => Promise<boolean>, ms = 10_000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return; await wait(150) } throw new Error('timed out') }

describe('Firebase sync (emulator)', () => {
  let A: Awaited<ReturnType<typeof device>>, B: Awaited<ReturnType<typeof device>>
  beforeAll(async () => { A = await device('justin@example.com', 'secret123', true); B = await device('justin@example.com') })

  it('both devices sign in to the same account', () => { expect(A.user.uid).toBe(B.user.uid) })

  it('first sync merges both ways; newest wins on a shared record', async () => {
    await A.store.put<Rec>('books', { id: 'a', updatedAt: 10, title: 'only on A' })
    await B.store.put<Rec>('books', { id: 'b', updatedAt: 10, title: 'only on B' })
    await A.store.put<Rec>('books', { id: 's', updatedAt: 15, title: 'A older' })
    await B.store.put<Rec>('books', { id: 's', updatedAt: 20, title: 'B newer' })
    await A.engine.start(); await B.engine.start(); await A.engine.syncNow(); await B.engine.syncNow(); await A.engine.syncNow()
    for (const d of [A, B]) expect((await d.local.list<Rec>('books')).map((r) => r.title).sort()).toEqual(['B newer', 'only on A', 'only on B'])
  })

  it('live: a change on A arrives on B by itself; deletes too', async () => {
    await A.store.put<Rec>('progress', { id: 'p', updatedAt: Date.now(), title: '40%' })
    await until(async () => (await B.local.get<Rec>('progress', 'p'))?.title === '40%')
    await A.store.remove('progress', 'p')
    await until(async () => (await B.local.list('progress')).length === 0)
  })

  it('never overwrites a newer cloud record', async () => {
    await B.store.put<Rec>('books', { id: 'z', updatedAt: 900, title: 'newer' }); await B.engine.syncNow()
    expect(await A.remote.pushIfNewer(A.user.uid, 'books', { id: 'z', updatedAt: 100, title: 'stale' } as Rec)).toMatchObject({ written: false, current: { title: 'newer' } })
    await until(async () => (await A.local.get<Rec>('books', 'z'))?.title === 'newer')
  })

  it('undefined fields are fine (records often have optional fields)', async () => {
    await A.store.put('books', { id: 'u', updatedAt: Date.now(), title: 'x', author: undefined } as Rec)
    await A.engine.syncNow()
    await until(async () => !!(await B.local.get('books', 'u')))
  })

  it('another account cannot read or write this one’s data (rules)', async () => {
    const C = await device('someone@example.com', 'secret123', true)
    await expect(C.remote.pullSince(A.user.uid, 'books', 0)).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(C.remote.pushIfNewer(A.user.uid, 'books', { id: 'evil', updatedAt: Date.now() })).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('auth errors come back in plain words', async () => {
    const h = await firebase({ config, emulators, name: `dev${n++}` })
    const auth = await authApi(h.auth)
    await expect(auth.signIn('justin@example.com', 'wrong-password')).rejects.toThrow('That email and password don’t match.')
    await expect(auth.signUp('justin@example.com', 'secret123')).rejects.toThrow(/already an account/)
    await expect(auth.signUp('new@example.com', '123')).rejects.toThrow(/at least 6/)
  })
})
