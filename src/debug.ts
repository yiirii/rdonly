// Test hooks, loaded only when the URL hash is #debug.
import { extractMeta } from './core/metadata'
import { makeThumb } from './core/cover'
import { detectFormat } from './core/formats'
import { createOpfsFileStore, getFileStore } from './storage/files'
import { getRecordStore } from './storage/select'
import { libraryStore } from './state/library'
import { settingsStore } from './state/settings'
import { setSyncBackend, syncStore } from './state/sync'
import { fakeBackend } from './sync/fakeBackend'

// e2e: when the test runner provides a stand-in cloud, use it instead of Firebase.
if ((window as unknown as { cloudAuth?: unknown }).cloudAuth) setSyncBackend(async () => fakeBackend())
;(window as unknown as { __rdonly: unknown }).__rdonly = {
  extractMeta, makeThumb, detectFormat, createOpfsFileStore, records: getRecordStore, files: getFileStore, library: libraryStore, settings: () => settingsStore, sync: () => syncStore,
  fakeSyncReady: true,
}
