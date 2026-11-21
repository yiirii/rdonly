import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { BaseRecord, FileStore, RecordStore } from '../src/storage/types'

const SAFE = /^[a-zA-Z0-9_-]+$/
const check = (kind: string, v: string) => { if (!SAFE.test(v)) throw new Error(`Invalid ${kind}: ${v}`) }

/** Records as one JSON file per collection (atomic temp+rename); books as files. */
export function createDiskStorage(root: string): { records: RecordStore; files: Omit<FileStore, 'getBlob'> } {
  const recDir = join(root, 'records')
  const bookDir = join(root, 'books')
  const cache = new Map<string, Promise<Map<string, BaseRecord>>>()
  const queue = new Map<string, Promise<void>>()

  const load = (col: string) => {
    check('collection', col)
    if (!cache.has(col)) cache.set(col, (async () => {
      try {
        const arr = JSON.parse(await fs.readFile(join(recDir, `${col}.json`), 'utf8')) as BaseRecord[]
        return new Map(arr.map((r) => [r.id, r]))
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
        throw e
      }
    })())
    return cache.get(col)!
  }
  /** Read-modify-write on a copy, one at a time per collection; the cache changes only after the disk write succeeds. */
  const mutate = (col: string, change: (m: Map<string, BaseRecord>) => void) => {
    const next = (queue.get(col) ?? Promise.resolve()).then(async () => {
      const copy = new Map(await load(col))
      change(copy)
      await fs.mkdir(recDir, { recursive: true })
      const file = join(recDir, `${col}.json`)
      try {
        await fs.writeFile(`${file}.tmp`, JSON.stringify([...copy.values()]))
        await fs.rename(`${file}.tmp`, file)
      } catch (e) {
        await fs.rm(`${file}.tmp`, { force: true, recursive: true }).catch(() => {})
        throw e
      }
      cache.set(col, Promise.resolve(copy))
    })
    queue.set(col, next.catch(() => {}))
    return next
  }

  const records: RecordStore = {
    async get(col, id) { return (await load(col)).get(id) as never },
    async put(col, rec) { await mutate(col, (m) => m.set(rec.id, rec)) },
    async list(col, o) { return [...(await load(col)).values()].filter((r) => o?.includeDeleted || !r.deleted) as never },
    async remove(col, id) {
      await mutate(col, (m) => {
        const prev = m.get(id)
        m.set(id, { ...(prev ?? { id }), id, deleted: true, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) })
      })
    },
  }

  const findBook = async (id: string) => {
    check('id', id)
    const exact = new RegExp(`^${id}\\.[a-z0-9]+$`)
    try {
      for (const e of await fs.readdir(bookDir, { withFileTypes: true })) if (e.isFile() && exact.test(e.name)) return e.name
    } catch { /* no books yet */ }
    return undefined
  }
  const files: Omit<FileStore, 'getBlob'> = {
    async put(id, ext, bytes) {
      check('id', id); check('ext', ext)
      await fs.mkdir(bookDir, { recursive: true })
      const p = join(bookDir, `${id}.${ext}`)
      try {
        await fs.writeFile(`${p}.tmp`, bytes)
        await fs.rename(`${p}.tmp`, p)
      } catch (e) {
        await fs.rm(`${p}.tmp`, { force: true }).catch(() => {})
        throw e
      }
    },
    async get(id) { const n = await findBook(id); return n ? new Uint8Array(await fs.readFile(join(bookDir, n))) : undefined },
    async has(id) { return (await findBook(id)) !== undefined },
    async remove(id) { const n = await findBook(id); if (n) await fs.rm(join(bookDir, n)) },
    async usage() {
      let used = 0
      try { for (const n of await fs.readdir(bookDir)) used += (await fs.stat(join(bookDir, n))).size } catch { /* none yet */ }
      return { usedBytes: used }
    },
  }
  return { records, files }
}
