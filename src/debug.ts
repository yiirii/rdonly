// Test hooks, loaded only when the URL hash is #debug.
import { extractMeta } from './core/metadata'
import { makeThumb } from './core/cover'
import { detectFormat } from './core/formats'
import { createOpfsFileStore } from './storage/files'
;(window as unknown as { __rdonly: unknown }).__rdonly = { extractMeta, makeThumb, detectFormat, createOpfsFileStore }
