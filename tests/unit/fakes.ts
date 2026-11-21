import type { BaseRecord, FileStore, RecordStore } from '../../src/storage/types'

export function memRecords(): RecordStore & { failPut?: boolean } {
  const m = new Map<string, BaseRecord>()
  const s: RecordStore & { failPut?: boolean } = {
    async get(col, id) { return m.get(`${col}/${id}`) as never },
    async put(col, rec) { if (s.failPut) throw new Error('QuotaExceededError'); m.set(`${col}/${rec.id}`, rec) },
    async list(col, o) { return [...m.entries()].filter(([k, r]) => k.startsWith(`${col}/`) && (o?.includeDeleted || !r.deleted)).map(([, r]) => r) as never },
    async remove(col, id) { const p = m.get(`${col}/${id}`); m.set(`${col}/${id}`, { ...p!, deleted: true, updatedAt: (p?.updatedAt ?? 0) + 1 }) },
  }
  return s
}

export function memFiles(): FileStore & { failPut?: boolean } {
  const m = new Map<string, Uint8Array>()
  const s: FileStore & { failPut?: boolean } = {
    async put(id, _e, b) { if (s.failPut) throw new Error('QuotaExceededError'); m.set(id, b) },
    async get(id) { return m.get(id) },
    async getBlob(id) { const b = m.get(id); return b ? new Blob([b as unknown as BlobPart]) : undefined },
    async has(id) { return m.has(id) },
    async remove(id) { m.delete(id) },
    async usage() { return { usedBytes: [...m.values()].reduce((n, b) => n + b.length, 0) } },
  }
  return s
}
