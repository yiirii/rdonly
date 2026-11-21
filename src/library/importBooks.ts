import { sha256Hex } from '../core/hash'
import { detectFormat } from '../core/formats'
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
}

const defaultThumb = async (cover: Blob) => {
  const { makeThumb, blobToDataUrl } = await import('../core/cover')
  return blobToDataUrl(await makeThumb(cover))
}

export async function importFiles(input: { name: string; bytes: Uint8Array }[], deps: ImportDeps): Promise<ImportResult[]> {
  const out: ImportResult[] = []
  for (const f of input) out.push(await importOne(f, deps)) // sequential: keeps memory flat on the phone
  return out
}

async function importOne({ name, bytes }: { name: string; bytes: Uint8Array }, deps: ImportDeps): Promise<ImportResult> {
  const { records, files } = deps
  const now = deps.now ?? Date.now
  const format = detectFormat(name, bytes)
  if (!format) return { fileName: name, status: 'unsupported', message: 'Not an EPUB, PDF or CBZ file' }
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

  const t = now()
  const rec: BookRecord = {
    id, updatedAt: t, title: meta.title ?? titleFromFileName(name), format, tag: defaultTag(format, meta),
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
