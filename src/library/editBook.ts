import type { FileStore, RecordStore } from '../storage/types'
import type { BookRecord } from './types'

export type BookPatch = Partial<Pick<BookRecord, 'title' | 'author' | 'series' | 'volume' | 'tag' | 'modeOverride' | 'tags' | 'finished'>>

export async function updateBook(records: RecordStore, id: string, patch: BookPatch, now: () => number = Date.now): Promise<BookRecord> {
  const cur = await records.get<BookRecord>('books', id)
  if (!cur || cur.deleted) throw new Error('Book not found')
  const next: BookRecord = { ...cur }
  for (const [k, v] of Object.entries(patch) as [keyof BookPatch, unknown][]) {
    let val = typeof v === 'string' ? v.trim() : v
    if (Array.isArray(val)) { // tags: trimmed, no blanks, no duplicates (ignoring case)
      const seen = new Set<string>()
      val = val.map((t) => String(t).trim().replace(/\s+/g, ' ')).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
      if (!(val as string[]).length) val = undefined
    }
    if (val === '' || val === undefined || (typeof val === 'number' && !Number.isFinite(val))) delete (next as unknown as Record<string, unknown>)[k]
    else (next as unknown as Record<string, unknown>)[k] = val
  }
  if (!next.title) throw new Error('A book needs a title')
  if (patch.tag && patch.tag !== cur.tag && !('modeOverride' in patch)) delete next.modeOverride
  next.updatedAt = Math.max(now(), cur.updatedAt + 1)
  await records.put('books', next)
  return next
}

/** Removes the book's file and tombstones its record and reading position (so the delete can sync). */
export async function deleteBook(records: RecordStore, files: FileStore, id: string): Promise<void> {
  await files.remove(id)
  await records.remove('books', id)
  if (await records.get('progress', id)) await records.remove('progress', id)
  for (const it of await records.list<{ id: string; bookId: string } & import('../storage/types').BaseRecord>('collectionItems')) {
    if (it.bookId === id) await records.remove('collectionItems', it.id)
  }
}
