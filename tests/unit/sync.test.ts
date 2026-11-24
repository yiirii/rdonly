import { describe, it, expect } from 'vitest'
import { wins } from '../../src/sync/merge'
import { syncedRecords, applyRemote, pendingOutbox } from '../../src/sync/outbox'
import { memoryRemote } from '../../src/sync/memoryRemote'
import { createSyncEngine, memoryCursors, type SyncEngine } from '../../src/sync/engine'
import type { BaseRecord, RecordStore } from '../../src/storage/types'
import { memRecords } from './fakes'

type Rec = BaseRecord & { title?: string }
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('merge: newest wins, ties converge', () => {
  it('newer wins, older loses, missing local always loses', () => {
    expect(wins({ id: 'a', updatedAt: 2 }, { id: 'a', updatedAt: 1 })).toBe(true)
    expect(wins({ id: 'a', updatedAt: 1 }, { id: 'a', updatedAt: 2 })).toBe(false)
    expect(wins({ id: 'a', updatedAt: 1 }, undefined)).toBe(true)
  })
  it('a tie picks the same winner from either side, and identical records never "win"', () => {
    const x: Rec = { id: 'a', updatedAt: 5, title: 'X' }, y: Rec = { id: 'a', updatedAt: 5, title: 'Y' }
    expect(wins(x, y)).not.toBe(wins(y, x))
    expect(wins(x, { ...x })).toBe(false)
    expect(wins({ title: 'X', updatedAt: 5, id: 'a' } as Rec, x)).toBe(false) // key order doesn't matter
  })
  it('a newer tombstone beats a live record', () => {
    expect(wins({ id: 'a', updatedAt: 9, deleted: true }, { id: 'a', updatedAt: 8 })).toBe(true)
  })
})

describe('outbox', () => {
  it('local writes and deletes are queued once per record; remote applies are not queued', async () => {
    const local = memRecords(); const r = syncedRecords(local)
    await r.put<Rec>('books', { id: 'b1', updatedAt: 1, title: 'A' })
    await r.put<Rec>('books', { id: 'b1', updatedAt: 2, title: 'B' })
    await r.remove('progress', 'p1')
    expect((await pendingOutbox(local)).map((e) => `${e.col}/${e.recId}`).sort()).toEqual(['books/b1', 'progress/p1'])
    expect(await applyRemote(local, 'books', { id: 'b2', updatedAt: 3 })).toBe(true)
    expect(await applyRemote(local, 'books', { id: 'b1', updatedAt: 1, title: 'old' } as Rec)).toBe(false) // older: ignored
    expect(await pendingOutbox(local)).toHaveLength(2)
    expect((await local.get<Rec>('books', 'b1'))!.title).toBe('B')
  })
})

// ---- Two devices sharing one cloud ----
function device(remote: ReturnType<typeof memoryRemote>, uid = 'u1', clockSkew = 0) {
  const local = memRecords()
  const cursors = memoryCursors()
  let engine: SyncEngine
  const store = syncedRecords(local, () => engine?.nudge())
  const now = () => Date.now() + clockSkew
  const make = (u = uid) => (engine = createSyncEngine({ local, remote, uid: u, cursors, pushDelayMs: 0 }))
  make()
  return { local, store, now, get engine() { return engine }, restart(u?: string) { engine.stop(); return make(u) } }
}
async function settle(...ds: { engine: SyncEngine }[]) { for (let i = 0; i < 6; i++) { for (const d of ds) await d.engine.syncNow(); await tick() } }

describe('sync engine (two devices, one cloud)', () => {
  it('first sync merges both ways, record by record', async () => {
    const cloud = memoryRemote(); const A = device(cloud), B = device(cloud)
    await A.store.put<Rec>('books', { id: 'a', updatedAt: 10, title: 'only on A' })
    await B.store.put<Rec>('books', { id: 'b', updatedAt: 10, title: 'only on B' })
    await B.store.put<Rec>('books', { id: 'shared', updatedAt: 20, title: 'B newer' })
    await A.store.put<Rec>('books', { id: 'shared', updatedAt: 15, title: 'A older' })
    await A.engine.start(); await B.engine.start(); await settle(A, B)
    for (const d of [A, B]) {
      expect((await d.local.list<Rec>('books')).map((r) => r.title).sort()).toEqual(['B newer', 'only on A', 'only on B'])
    }
  })

  it('records made before signing in on a device are uploaded on its first sync', async () => {
    const cloud = memoryRemote(); const A = device(cloud)
    await A.local.put<Rec>('books', { id: 'old', updatedAt: 1, title: 'from v0.4' }) // written before sync existed: not in the outbox
    await A.engine.start(); await settle(A)
    const B = device(cloud); await B.engine.start(); await settle(B)
    expect((await B.local.get<Rec>('books', 'old'))?.title).toBe('from v0.4')
  })

  it('live: an edit on A shows up on B without B asking, and deletes travel too', async () => {
    const cloud = memoryRemote(); const A = device(cloud), B = device(cloud)
    let changed = 0; B.engine.onChange(() => changed++)
    await A.engine.start(); await B.engine.start()
    await A.store.put<Rec>('progress', { id: 'p', updatedAt: Date.now(), title: '40%' })
    await settle(A); await tick()
    expect((await B.local.get<Rec>('progress', 'p'))?.title).toBe('40%')
    expect(changed).toBeGreaterThan(0)
    await A.store.remove('progress', 'p'); await settle(A); await tick()
    expect(await B.local.list('progress')).toHaveLength(0)
  })

  it('same-millisecond edits on both devices end with the same value everywhere', async () => {
    const cloud = memoryRemote(); const A = device(cloud), B = device(cloud)
    await A.engine.start(); await B.engine.start()
    await A.store.put<Rec>('books', { id: 'x', updatedAt: 500, title: 'A says' })
    await B.store.put<Rec>('books', { id: 'x', updatedAt: 500, title: 'B says' })
    await settle(A, B)
    const a = (await A.local.get<Rec>('books', 'x'))!.title, b = (await B.local.get<Rec>('books', 'x'))!.title
    expect(a).toBe(b)
  })

  it('a device whose clock is 10 minutes slow still sends and receives', async () => {
    const cloud = memoryRemote(); const A = device(cloud), Slow = device(cloud, 'u1', -600_000)
    await A.engine.start(); await Slow.engine.start(); await settle(A, Slow)
    await A.store.put<Rec>('books', { id: 'n1', updatedAt: A.now(), title: 'from A' })
    await settle(A, Slow)
    await Slow.store.put<Rec>('books', { id: 'n2', updatedAt: Slow.now(), title: 'from slow' })
    await settle(A, Slow)
    expect((await Slow.local.get<Rec>('books', 'n1'))?.title).toBe('from A')
    expect((await A.local.get<Rec>('books', 'n2'))?.title).toBe('from slow')
  })

  it('offline: changes wait in the outbox across a restart, then go up once online', async () => {
    const cloud = memoryRemote(); const A = device(cloud)
    await A.engine.start(); await settle(A)
    cloud.offline = true
    await A.store.put<Rec>('books', { id: 'o1', updatedAt: Date.now(), title: 'made offline' })
    await A.engine.syncNow()
    expect(A.engine.status().state).toBe('offline')
    expect(A.engine.status().pending).toBe(1)
    A.restart(); cloud.offline = false
    await A.engine.start(); await settle(A)
    expect(A.engine.status()).toMatchObject({ state: 'idle', pending: 0 })
    expect(cloud.peek('u1', 'books', 'o1')?.title).toBe('made offline')
  })

  it('never overwrites a newer record in the cloud', async () => {
    const cloud = memoryRemote(); const A = device(cloud)
    cloud.seed('u1', 'books', { id: 'z', updatedAt: 900, title: 'newer in cloud' } as Rec)
    await A.store.put<Rec>('books', { id: 'z', updatedAt: 100, title: 'stale' })
    await A.engine.start(); await settle(A)
    expect(cloud.peek('u1', 'books', 'z')?.title).toBe('newer in cloud')
    expect((await A.local.get<Rec>('books', 'z'))?.title).toBe('newer in cloud')
  })

  it('after stop (sign out) nothing more is written to the cloud, and another account never gets the first one\'s writes', async () => {
    const cloud = memoryRemote(); const A = device(cloud)
    await A.store.put<Rec>('books', { id: 'mine', updatedAt: 1 })
    await A.engine.start(); await settle(A)
    A.engine.stop()
    await A.store.put<Rec>('books', { id: 's1', updatedAt: Date.now(), title: 'after sign out' })
    await tick(); await tick()
    expect(cloud.peek('u1', 'books', 's1')).toBeUndefined()
    const writesBefore = cloud.writes
    A.restart('u2'); // signs in as someone else: this device's books join that account; u1 gets nothing more
    await A.engine.start(); await settle(A)
    expect(cloud.peek('u1', 'books', 's1')).toBeUndefined()
    expect(cloud.writes).toBeGreaterThan(writesBefore)
    expect(cloud.uidsWritten()).toEqual(['u1', 'u2'])
  })

  it('a restart resumes from where it left off instead of downloading everything again', async () => {
    const cloud = memoryRemote(); const A = device(cloud), B = device(cloud)
    for (let i = 0; i < 20; i++) await A.store.put<Rec>('books', { id: `k${i}`, updatedAt: i + 1 })
    await A.engine.start(); await B.engine.start(); await settle(A, B)
    const pulled = cloud.pulled
    B.restart(); await B.engine.start(); await settle(B)
    expect(cloud.pulled - pulled).toBe(0)
  })

  it('only the synced collections leave the device', async () => {
    const cloud = memoryRemote(); const A = device(cloud)
    await (A.store as RecordStore).put('scratch', { id: 'q', updatedAt: 1 })
    await A.store.put('settings', { id: 'theme', updatedAt: 1 })
    await A.engine.start(); await settle(A)
    expect(cloud.peek('u1', 'scratch', 'q')).toBeUndefined()
    expect(cloud.peek('u1', 'settings', 'theme')).toBeDefined()
  })
})
