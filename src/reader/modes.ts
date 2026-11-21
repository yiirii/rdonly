import type { BookTag } from '../core/tags'

export type ReaderModeName = 'novel' | 'paged-ltr' | 'paged-rtl' | 'webtoon' | 'pdf'
export const MODES: ReaderModeName[] = ['novel', 'paged-ltr', 'paged-rtl', 'webtoon', 'pdf']
export const MODE_LABELS: Record<ReaderModeName, string> = {
  novel: 'Book pages', 'paged-ltr': 'Comic (left to right)', 'paged-rtl': 'Manga (right to left)', webtoon: 'Webtoon (scroll)', pdf: 'Document',
}
const BY_TAG: Record<BookTag, ReaderModeName> = { novel: 'novel', manga: 'paged-rtl', comic: 'paged-ltr', webtoon: 'webtoon', document: 'pdf' }

export function modeFor(book: { tag: BookTag; modeOverride?: string }): ReaderModeName {
  const o = book.modeOverride as ReaderModeName | undefined
  return o && MODES.includes(o) ? o : BY_TAG[book.tag]
}
