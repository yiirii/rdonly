// Test hooks, loaded only when the URL hash is #debug.
import { extractMeta } from './core/metadata'
import { makeThumb } from './core/cover'
import { detectFormat } from './core/formats'
import { createOpfsFileStore, getFileStore } from './storage/files'
import { getRecordStore } from './storage/select'
import { libraryStore } from './state/library'
;(window as unknown as { __rdonly: unknown }).__rdonly = {
  extractMeta, makeThumb, detectFormat, createOpfsFileStore, records: getRecordStore, files: getFileStore, library: libraryStore,
}
