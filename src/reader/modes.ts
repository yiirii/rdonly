import type { BookTag } from '../core/tags'
import type { BookFormat } from '../core/formats'

export type ReaderModeName = 'novel' | 'paged-ltr' | 'paged-rtl' | 'webtoon' | 'pdf'
export const MODES: ReaderModeName[] = ['novel', 'paged-ltr', 'paged-rtl', 'webtoon', 'pdf']
export const MODE_LABELS: Record<ReaderModeName, string> = {
  novel: 'Book pages', 'paged-ltr': 'Comic (left to right)', 'paged-rtl': 'Manga (right to left)', webtoon: 'Webtoon (scroll)', pdf: 'Document',
}
export const COMIC_MODES: ReaderModeName[] = ['paged-rtl', 'paged-ltr', 'webtoon']
const COMIC_BY_TAG: Partial<Record<BookTag, ReaderModeName>> = { manga: 'paged-rtl', webtoon: 'webtoon', comic: 'paged-ltr' }

/** The file format decides what can be shown; for comics the tag (or a per-book choice) picks the direction. */
export function modeFor(book: { format: BookFormat; tag: BookTag; modeOverride?: string }): ReaderModeName {
  if (book.format === 'epub') return 'novel'
  if (book.format === 'pdf') return 'pdf'
  const o = book.modeOverride as ReaderModeName | undefined
  if (o && COMIC_MODES.includes(o)) return o
  return COMIC_BY_TAG[book.tag] ?? 'paged-ltr'
}
