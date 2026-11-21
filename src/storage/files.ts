import { openDB, type IDBPDatabase } from 'idb'
import { bridge, type FileStore } from './types'

/** Fallback: book files as blobs in IndexedDB. */
export function createIdbFileStore(name = 'rdonly-files'): FileStore {
  let db: Promise<IDBPDatabase> | undefined
  // 'sizes' mirrors each book's byte size so Settings never loads the books themselves.
  const open = () => (db ??= openDB(name, 2, {
    upgrade: (d, old) => {
      if (old < 1) d.createObjectStore('files')
      if (old < 2) d.createObjectStore('sizes')
    },
  }))
  return {
    async put(id, ext, bytes) {
      const tx = (await open()).transaction(['files', 'sizes'], 'readwrite')
      await Promise.all([tx.objectStore('files').put({ ext, bytes }, id), tx.objectStore('sizes').put(bytes.byteLength, id), tx.done])
    },
    async get(id) { return ((await (await open()).get('files', id)) as { bytes: Uint8Array } | undefined)?.bytes },
    async has(id) { return (await (await open()).getKey('files', id)) !== undefined },
    async remove(id) {
      const tx = (await open()).transaction(['files', 'sizes'], 'readwrite')
      await Promise.all([tx.objectStore('files').delete(id), tx.objectStore('sizes').delete(id), tx.done])
    },
    async usage() {
      const sizes = (await (await open()).getAll('sizes')) as number[]
      return { usedBytes: sizes.reduce((n, b) => n + b, 0), ...(await quota()) }
    },
  }
}

/** Preferred in browsers: Origin Private File System, files at books/{id}.{ext}. */
export function createOpfsFileStore(): FileStore {
  const dir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('books', { create: true })
  const find = async (id: string) => {
    const exact = new RegExp(`^${id}\\.[a-z0-9]+$`)
    for await (const [name, h] of (await dir()) as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      if (h.kind === 'file' && exact.test(name)) return { name, h: h as FileSystemFileHandle }
    }
    return undefined
  }
  return {
    async put(id, ext, bytes) {
      const d = await dir()
      const name = `${id}.${ext}`
      const existed = await d.getFileHandle(name).then(() => true, () => false)
      const h = await d.getFileHandle(name, { create: true })
      const w = await h.createWritable()
      try {
        await w.write(bytes as unknown as FileSystemWriteChunkType)
        await w.close()
      } catch (e) {
        await w.abort().catch(() => {})
        if (!existed) await d.removeEntry(name).catch(() => {})
        throw e
      }
    },
    async get(id) {
      const f = await find(id)
      return f ? new Uint8Array(await (await f.h.getFile()).arrayBuffer()) : undefined
    },
    async has(id) { return (await find(id)) !== undefined },
    async remove(id) { const f = await find(id); if (f) await (await dir()).removeEntry(f.name) },
    async usage() {
      let used = 0
      for await (const [, h] of (await dir()) as unknown as AsyncIterable<[string, FileSystemHandle]>) {
        if (h.kind === 'file') used += (await (h as FileSystemFileHandle).getFile()).size
      }
      return { usedBytes: used, ...(await quota()) }
    },
  }
}

async function quota(): Promise<{ quotaBytes?: number }> {
  try { const e = await navigator.storage?.estimate?.(); return e?.quota ? { quotaBytes: e.quota } : {} } catch { return {} }
}

export type FileBackend = 'opfs' | 'idb'
const BACKEND_KEY = 'rdonly.fileBackend'

/** A device keeps the backend it started with, so books never get stranded when the browser gains OPFS later. */
export function chooseFileBackend(hasOpfs: boolean, saved: string | null): FileBackend {
  if (saved === 'opfs' || saved === 'idb') return saved
  return hasOpfs ? 'opfs' : 'idb'
}

let chosen: FileStore | undefined
export function getFileStore(): FileStore {
  const b = bridge()
  if (b?.files) return b.files
  if (chosen) return chosen
  let saved: string | null = null
  try { saved = localStorage.getItem(BACKEND_KEY) } catch { /* private mode */ }
  const hasOpfs = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
    && typeof (globalThis as { FileSystemFileHandle?: { prototype: object } }).FileSystemFileHandle?.prototype === 'object'
    && 'createWritable' in ((globalThis as unknown as { FileSystemFileHandle: { prototype: object } }).FileSystemFileHandle.prototype)
  const backend = chooseFileBackend(hasOpfs, saved)
  try { localStorage.setItem(BACKEND_KEY, backend) } catch { /* private mode */ }
  return (chosen = backend === 'opfs' ? createOpfsFileStore() : createIdbFileStore())
}
