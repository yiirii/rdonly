import { openDB, type IDBPDatabase } from 'idb'
import { bridge, type FileStore } from './types'

/** Fallback: book files as blobs in IndexedDB. */
export function createIdbFileStore(name = 'rdonly-files'): FileStore {
  let db: Promise<IDBPDatabase> | undefined
  const open = () => (db ??= openDB(name, 1, { upgrade: (d) => { d.createObjectStore('files') } }))
  return {
    async put(id, ext, bytes) { await (await open()).put('files', { ext, bytes }, id) },
    async get(id) { return ((await (await open()).get('files', id)) as { bytes: Uint8Array } | undefined)?.bytes },
    async has(id) { return (await (await open()).getKey('files', id)) !== undefined },
    async remove(id) { await (await open()).delete('files', id) },
    async usage() {
      const all = (await (await open()).getAll('files')) as { bytes: Uint8Array }[]
      return { usedBytes: all.reduce((n, f) => n + f.bytes.byteLength, 0), ...(await quota()) }
    },
  }
}

/** Preferred in browsers: Origin Private File System, files at books/{id}.{ext}. */
export function createOpfsFileStore(): FileStore {
  const dir = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('books', { create: true })
  const find = async (id: string) => {
    for await (const [name, h] of (await dir()) as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      if (h.kind === 'file' && name.split('.')[0] === id) return { name, h: h as FileSystemFileHandle }
    }
    return undefined
  }
  return {
    async put(id, ext, bytes) {
      const h = await (await dir()).getFileHandle(`${id}.${ext}`, { create: true })
      const w = await h.createWritable()
      await w.write(bytes as unknown as FileSystemWriteChunkType)
      await w.close()
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

let chosen: FileStore | undefined
export function getFileStore(): FileStore {
  const b = bridge()
  if (b?.files) return b.files
  if (chosen) return chosen
  const hasOpfs = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
    && typeof (globalThis as { FileSystemFileHandle?: { prototype: object } }).FileSystemFileHandle?.prototype === 'object'
    && 'createWritable' in ((globalThis as unknown as { FileSystemFileHandle: { prototype: object } }).FileSystemFileHandle.prototype)
  return (chosen = hasOpfs ? createOpfsFileStore() : createIdbFileStore())
}
