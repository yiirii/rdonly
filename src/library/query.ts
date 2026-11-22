import type { BookTag } from '../core/tags'
import { naturalCompare } from '../core/metadata/util'
import type { ProgressRecord } from '../state/progress'
import type { BaseRecord } from '../storage/types'
import { groupLibrary, type ShelfItem } from './series'
import type { BookRecord } from './types'

export type Status = 'new' | 'reading' | 'finished'
export type SortKey = 'added' | 'read' | 'title'
export interface CollectionRecord extends BaseRecord { name: string; color: string; order: number }
export interface CollectionItemRecord extends BaseRecord { collectionId: string; bookId: string }
export interface LibraryData { books: BookRecord[]; progress: ProgressRecord[]; collections: CollectionRecord[]; items: CollectionItemRecord[] }
/** tab: 'all' | a status | a collection id */
export interface LibraryQuery { tab?: string; types?: BookTag[]; search?: string; sort?: SortKey }

export const FINISHED_AT = 0.98

export function bookStatus(book: Pick<BookRecord, 'finished'>, progress?: Pick<ProgressRecord, 'percent'>): Status {
  if (book.finished === true) return 'finished'
  if (!progress) return book.finished === false ? 'reading' : 'new'
  if (book.finished === false) return 'reading'
  return progress.percent >= FINISHED_AT ? 'finished' : 'reading'
}

/** Lower-case, accents removed, punctuation as spaces: "Sci-Fi" ~ "sci fi", "Café" ~ "cafe". */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function queryLibrary(data: LibraryData, q: LibraryQuery) {
  const live = data.books.filter((b) => !b.deleted)
  const ids = new Set(live.map((b) => b.id))
  const prog = new Map(data.progress.filter((p) => !p.deleted && ids.has(p.id)).map((p) => [p.id, p]))
  const status = new Map(live.map((b) => [b.id, bookStatus(b, prog.get(b.id))]))
  const members = new Map<string, Set<string>>()
  for (const it of data.items) {
    if (it.deleted || !ids.has(it.bookId)) continue
    if (!members.has(it.collectionId)) members.set(it.collectionId, new Set())
    members.get(it.collectionId)!.add(it.bookId)
  }

  const counts: Record<string, number> = { all: live.length, reading: 0, new: 0, finished: 0 }
  for (const s of status.values()) counts[s]++
  for (const c of data.collections) if (!c.deleted) counts[c.id] = members.get(c.id)?.size ?? 0

  const tab = q.tab ?? 'all'
  const needle = q.search ? fold(q.search) : ''
  const words = needle ? needle.split(' ') : []
  const matches = (b: BookRecord) => {
    if (tab === 'reading' || tab === 'new' || tab === 'finished') { if (status.get(b.id) !== tab) return false }
    else if (tab !== 'all' && !members.get(tab)?.has(b.id)) return false
    if (q.types?.length && !q.types.includes(b.tag)) return false
    if (words.length) {
      const hay = fold([b.title, b.author, b.series, ...(b.tags ?? [])].filter(Boolean).join(' '))
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  }

  const lastReadAt = (b: BookRecord) => prog.get(b.id)?.updatedAt ?? -1
  const sorters: Record<SortKey, (a: BookRecord, z: BookRecord) => number> = {
    added: (a, z) => z.addedAt - a.addedAt,
    read: (a, z) => lastReadAt(z) - lastReadAt(a) || z.addedAt - a.addedAt,
    title: (a, z) => naturalCompare(a.title, z.title),
  }
  const shown = live.filter(matches).sort(sorters[q.sort ?? 'added'])
  const items: ShelfItem[] = groupLibrary(shown)

  let lastRead: BookRecord | undefined
  for (const b of live) if (prog.has(b.id) && (!lastRead || lastReadAt(b) > lastReadAt(lastRead))) lastRead = b
  return { lastRead, lastReadProgress: lastRead ? prog.get(lastRead.id) : undefined, items, counts, status }
}
