import type { BookFormat } from '../formats'
import type { BookMeta } from './types'
import { epubMeta } from './epub'
import { cbzMeta, parseComicInfo } from './cbz'

export type { BookMeta } from './types'

export async function extractMeta(format: BookFormat, bytes: Uint8Array): Promise<BookMeta> {
  if (format === 'epub') return epubMeta(bytes)
  if (format === 'cbz') return cbzMeta(bytes)
  if (format === 'cbr' || format === 'cb7') {
    const { openLibarchive } = await import('../../archive/libarchive')
    const src = await openLibarchive(new Blob([bytes as unknown as BlobPart]))
    try {
      if (!src.count) throw new Error('No pages found in this comic')
      return { ...(src.comicInfo ? parseComicInfo(src.comicInfo) : {}), cover: await src.page(0) }
    } finally { src.close() }
  }
  return (await import('./pdf')).pdfMeta(bytes)
}
