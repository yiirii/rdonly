import type { BookFormat } from '../formats'
import type { BookMeta } from './types'
import { epubMeta } from './epub'
import { cbzMeta } from './cbz'

export type { BookMeta } from './types'

export async function extractMeta(format: BookFormat, bytes: Uint8Array): Promise<BookMeta> {
  if (format === 'epub') return epubMeta(bytes)
  if (format === 'cbz') return cbzMeta(bytes)
  return (await import('./pdf')).pdfMeta(bytes)
}
