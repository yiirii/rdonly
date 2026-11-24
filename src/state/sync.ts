import { createStore, useStore } from 'zustand'
import { getBaseRecordStore, setLocalWriteHook } from '../storage/select'
import { getFileStore } from '../storage/files'
import type { BookRecord } from '../library/types'
import type { SyncUser } from '../sync/auth'
import { createSyncEngine, localCursors, type SyncEngine, type SyncStatus } from '../sync/engine'
import type { Remote } from '../sync/remote'

export interface SyncBackend {
  auth: {
    signIn(email: string, pw: string): Promise<SyncUser>
    signUp(email: string, pw: string): Promise<SyncUser>
    signOut(): Promise<void>
    resetPassword(email: string): Promise<void>
    onUser(fn: (u: SyncUser | null) => void): () => void
  }
  remote: Remote
}

const ON_KEY = 'rdonly.sync.on'
/** The account this device's library belongs to; a different one must be confirmed before anything is copied to it. */
const LAST_UID = 'rdonly.sync.lastUid'
const lsGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } }
let override: (() => Promise<SyncBackend>) | undefined
/** Tests (#debug) swap Firebase for a stand-in cloud. */
export function setSyncBackend(make: () => Promise<SyncBackend>) { override = make }

async function realBackend(): Promise<SyncBackend> {
  const [{ firebase }, { authApi }, { firebaseRemote }] = await Promise.all([import('../sync/firebase'), import('../sync/auth'), import('../sync/firebaseRemote')])
  const h = await firebase()
  return { auth: await authApi(h.auth), remote: await firebaseRemote(h.db) }
}

interface SyncStoreState {
  user: SyncUser | null
  status: SyncStatus
  /** Set once we know whether someone is signed in (avoids a flash of the sign-in form). */
  known: boolean
  /** Signed in with a different account than this device's library came from: waiting for "Add my library" or "Cancel". */
  askMerge: boolean
  confirmMerge(): void
  cancelMerge(): Promise<void>
  signIn(email: string, pw: string): Promise<void>
  signUp(email: string, pw: string): Promise<void>
  resetPassword(email: string): Promise<void>
  signOut(): Promise<void>
  syncNow(): Promise<void>
}

let backend: Promise<SyncBackend> | undefined
let engine: SyncEngine | undefined
let listening = false
let currentRemote: Remote | undefined
const getBackend = () => (backend ??= (override ?? realBackend)())

export const syncStore = createStore<SyncStoreState>()(() => ({
  user: null, status: { state: 'off', pending: 0 }, known: false, askMerge: false,
  confirmMerge() { const u = syncStore.getState().user; if (!u || !currentRemote) return; lsSet(LAST_UID, u.uid); syncStore.setState({ askMerge: false }); startFor(u, currentRemote) },
  async cancelMerge() { syncStore.setState({ askMerge: false }); await (await getBackend()).auth.signOut() },
  async signIn(email, pw) { await listen(); await (await getBackend()).auth.signIn(email, pw) },
  async signUp(email, pw) { await listen(); await (await getBackend()).auth.signUp(email, pw) },
  async resetPassword(email) { await (await getBackend()).auth.resetPassword(email) },
  async signOut() { await (await getBackend()).auth.signOut() },
  async syncNow() { await engine?.syncNow() },
}))
export const useSync = <T,>(sel: (s: SyncStoreState) => T) => useStore(syncStore, sel)

let reloadTimer: ReturnType<typeof setTimeout> | undefined
const pendingCols = new Set<string>()
function onRemoteChange(cols: Set<string>) {
  for (const c of cols) pendingCols.add(c)
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(async () => {
    const cols = new Set(pendingCols); pendingCols.clear()
    if (cols.has('books')) await dropFilesOfDeletedBooks()
    const [{ libraryStore }, { settingsStore }] = await Promise.all([import('./library'), import('./settings')])
    if (cols.has('settings')) await settingsStore.getState().load()
    await libraryStore().getState().load()
  }, 300)
}

/** A book deleted on another device goes from this one too, file included. */
async function dropFilesOfDeletedBooks() {
  const files = getFileStore()
  for (const b of await getBaseRecordStore().list<BookRecord>('books', { includeDeleted: true })) if (b.deleted && (await files.has(b.id))) await files.remove(b.id)
}

function startFor(user: SyncUser, remote: Remote) {
  engine?.stop()
  const e = createSyncEngine({ local: getBaseRecordStore(), remote, uid: user.uid, cursors: localCursors() })
  engine = e
  e.onStatus((status) => { if (engine === e) syncStore.setState({ status }) })
  e.onChange(onRemoteChange)
  setLocalWriteHook(() => engine?.nudge())
  void e.start()
}

async function listen() {
  if (listening) return
  listening = true
  let b: SyncBackend
  try { b = await getBackend() } catch {
    // Couldn't load sync (e.g. offline on first use): let the next tap try again.
    listening = false; backend = undefined; syncStore.setState({ known: true })
    throw new Error('Couldn’t reach the sync service. Check your connection and try again.')
  }
  currentRemote = b.remote
  b.auth.onUser((user) => {
    lsSet(ON_KEY, user ? '1' : null)
    if (!user) { engine?.stop(); engine = undefined; syncStore.setState({ user, known: true, askMerge: false, status: { state: 'off', pending: 0 } }); return }
    const last = lsGet(LAST_UID)
    if (last && last !== user.uid) { engine?.stop(); engine = undefined; syncStore.setState({ user, known: true, askMerge: true, status: { state: 'off', pending: 0 } }); return }
    lsSet(LAST_UID, user.uid)
    syncStore.setState({ user, known: true, askMerge: false })
    startFor(user, b.remote)
  })
}

/** At start-up: only load Firebase if this device has signed in before. */
export function initSync() {
  let on = false
  try { on = localStorage.getItem(ON_KEY) === '1' } catch { /* ignore */ }
  if (on || override) void listen()
  else syncStore.setState({ known: true })
  addEventListener('online', () => void engine?.syncNow())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void engine?.syncNow() })
}
