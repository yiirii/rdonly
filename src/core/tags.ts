import type { BookFormat } from './formats'
import type { BookMeta } from './metadata/types'

export type BookTag = 'novel' | 'manga' | 'webtoon' | 'comic' | 'document'

export function defaultTag(format: BookFormat, meta: Pick<BookMeta, 'mangaHint'>): BookTag {
  if (format === 'epub') return 'novel'
  if (format === 'pdf') return 'document'
  return meta.mangaHint ? 'manga' : 'comic'
}
