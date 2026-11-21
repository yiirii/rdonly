import { naturalCompare } from '../core/metadata/util'
import type { BookRecord } from './types'

export type ShelfItem = { kind: 'book'; book: BookRecord } | { kind: 'series'; key: string; name: string; books: BookRecord[] }

export const seriesKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** Books sharing a series (2 or more) become one folder, placed where its first book appears; volumes sorted A–Z (natural). */
export function groupLibrary(sortedBooks: BookRecord[]): ShelfItem[] {
  const counts = new Map<string, number>()
  for (const bk of sortedBooks) if (bk.series?.trim()) counts.set(seriesKey(bk.series), (counts.get(seriesKey(bk.series)) ?? 0) + 1)
  const out: ShelfItem[] = []
  const folders = new Map<string, Extract<ShelfItem, { kind: 'series' }>>()
  for (const bk of sortedBooks) {
    const key = bk.series?.trim() ? seriesKey(bk.series) : ''
    if (!key || (counts.get(key) ?? 0) < 2) { out.push({ kind: 'book', book: bk }); continue }
    let f = folders.get(key)
    if (!f) { f = { kind: 'series', key, name: bk.series!.trim().replace(/\s+/g, ' '), books: [] }; folders.set(key, f); out.push(f) }
    f.books.push(bk)
  }
  for (const f of folders.values()) {
    f.books.sort((a, z) => naturalCompare(a.title, z.title))
    f.name = pickName(f.books.map((x) => x.series!.trim().replace(/\s+/g, ' ')))
  }
  return out
}

/** The spelling most books use; on a tie, the one with capitals. */
function pickName(names: string[]): string {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts.entries()].sort((a, z) => z[1] - a[1] || Number(/[A-Z]/.test(z[0])) - Number(/[A-Z]/.test(a[0])))[0][0]
}
