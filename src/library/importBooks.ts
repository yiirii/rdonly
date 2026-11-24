import { sha256Hex } from '../core/hash'
import { COMIC_FORMATS, detectFormat, type BookFormat } from '../core/formats'
import { looksLikeWebtoon } from '../core/webtoon'
import { extractMeta } from '../core/metadata'
import { defaultTag } from '../core/tags'
import { titleFromFileName } from '../core/title'
import type { FileStore, RecordStore } from '../storage/types'
import type { BookRecord, ImportResult } from './types'

export interface ImportDeps {
  records: RecordStore
  files: FileStore
  now?: () => number
  /** Turns a cover into a small data URL; injected so it can run without a canvas in tests. */
  thumb?: (cover: Blob) => Promise<string | undefined>
  /** Sizes of the first pages of a comic, used to spot webtoons; injectable for tests. */
  pageSizes?: (format: BookFormat, bytes: Uint8Array) => Promise<{ w: number; h: number }[]>
}

const defaultPageSizes = async (format: BookFormat, bytes: Uint8Array) => {
  if (typeof createImageBitmap !== 'function') return []
  const { firstPageSizes } = await import('../core/webtoon')
  return firstPageSizes(new Blob([bytes as unknown as BlobPart]), format)
}

const defaultThumb = async (cover: Blob) => {
  const { makeThumb, blobToDataUrl } = await import('../core/cover')
  return blobToDataUrl(await makeThumb(cover))
}

/** A file to import; its bytes are read only when its turn comes, so one book is in memory at a time. */
export interface ImportItem { name: string; read: () => Promise<Uint8Array> }

export async function importFiles(input: ImportItem[], deps: ImportDeps): Promise<ImportResult[]> {
  const out: ImportResult[] = []
  for (const item of input) {
    let bytes: Uint8Array
    try { bytes = await item.read() } catch { out.push({ fileName: item.name, status: 'error', message: 'Could not read the file' }); continue }
    try { out.push(await importOne(item.name, bytes, deps)) } catch { out.push({ fileName: item.name, status: 'error', message: 'Something went wrong saving this book' }) }
  }
  return out
}

async function importOne(name: string, bytes: Uint8Array, deps: ImportDeps): Promise<ImportResult> {
  const { records, files } = deps
  const now = deps.now ?? Date.now
  const format = detectFormat(name, bytes)
  if (!format) return { fileName: name, status: 'unsupported', message: 'Not an EPUB, PDF or comic file' }
  let id: string
  try { id = await sha256Hex(bytes) } catch { return { fileName: name, status: 'error', message: 'Could not read the file' } }

  const existing = await records.get<BookRecord>('books', id)
  if (existing && !existing.deleted) {
    if (await files.has(id)) return { fileName: name, status: 'duplicate', bookId: id }
    try { await files.put(id, format, bytes) } catch { return { fileName: name, status: 'error', bookId: id, message: 'Not enough storage space' } }
    return { fileName: name, status: 'relinked', bookId: id }
  }

  let meta
  try { meta = await extractMeta(format, bytes) } catch { return { fileName: name, status: 'error', message: 'The file looks damaged' } }
  let coverThumb: string | undefined
  if (meta.cover) { try { coverThumb = await (deps.thumb ?? defaultThumb)(meta.cover) } catch { /* placeholder cover is fine */ } }

  let tag = defaultTag(format, meta)
  if (COMIC_FORMATS.includes(format)) {
    try { if (looksLikeWebtoon(await (deps.pageSizes ?? defaultPageSizes)(format, bytes))) tag = 'webtoon' } catch { /* keep the default */ }
  }
  const t = now()
  const rec: BookRecord = {
    // Newer than a delete that may have come from a device whose clock runs ahead.
    id, updatedAt: existing ? Math.max(t, existing.updatedAt + 1) : t, title: meta.title ?? titleFromFileName(name), format, tag,
    fileName: name, fileSize: bytes.length, addedAt: t,
    ...(meta.author && { author: meta.author }), ...(meta.series && { series: meta.series }),
    ...(meta.volume !== undefined && { volume: meta.volume }), ...(coverThumb && { coverThumb }),
  }
  // File first, record second: a book never appears without its file.
  try { await files.put(id, format, bytes) } catch { return { fileName: name, status: 'error', message: 'Not enough storage space' } }
  try { await records.put('books', rec) } catch {
    await files.remove(id).catch(() => {})
    return { fileName: name, status: 'error', message: 'Could not save to storage' }
  }
  return { fileName: name, status: 'added', bookId: id }
}
