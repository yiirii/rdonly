import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firebaseConfig } from './config'

export interface FirebaseHandles { app: FirebaseApp; auth: Auth; db: Firestore }
export interface EmulatorHosts { auth: string; firestore: { host: string; port: number } }

let handles: Promise<FirebaseHandles> | undefined

/** Loads Firebase only when sync is used, so the reader stays light for everyone else. */
export function firebase(opts: { config?: typeof firebaseConfig; emulators?: EmulatorHosts; name?: string } = {}): Promise<FirebaseHandles> {
  const make = async () => {
    const [{ initializeApp }, a, f] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const app = initializeApp(opts.config ?? firebaseConfig, opts.name)
    // No popup/redirect resolver: email + password only.
    const auth = typeof indexedDB !== 'undefined'
      ? a.initializeAuth(app, { persistence: [a.indexedDBLocalPersistence, a.browserLocalPersistence] })
      : a.initializeAuth(app, { persistence: a.inMemoryPersistence })
    // Our own local store is the offline copy, so Firestore keeps only a memory cache.
    const db = f.initializeFirestore(app, { localCache: f.memoryLocalCache(), ignoreUndefinedProperties: true })
    if (opts.emulators) {
      a.connectAuthEmulator(auth, opts.emulators.auth, { disableWarnings: true })
      f.connectFirestoreEmulator(db, opts.emulators.firestore.host, opts.emulators.firestore.port)
    }
    return { app, auth, db }
  }
  if (opts.name) return make() // tests: separate apps per "device"
  return (handles ??= make())
}
