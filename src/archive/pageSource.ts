import type { BookFormat } from '../core/formats'
import { comicPages } from '../core/metadata/cbz'
import { mimeFor } from '../core/metadata/util'
import { readZipEntry, readZipIndex } from './blobZip'

export interface PageSource {
  count: number
  names: string[]
  page(i: number): Promise<Blob>
  close(): void
}

export async function openPageSource(file: Blob, format: BookFormat): Promise<PageSource> {
  if (format === 'cbz') {
    const idx = await readZipIndex(file)
    const byName = new Map(idx.map((e) => [e.name, e]))
    const names = comicPages(idx.map((e) => e.name))
    return {
      count: names.length,
      names,
      async page(i) {
        const n = names[i]
        const bytes = await readZipEntry(file, byName.get(n)!)
        return new Blob([bytes as unknown as BlobPart], { type: mimeFor(n) })
      },
      close() {},
    }
  }
  if (format === 'cbr' || format === 'cb7') return (await import('./libarchive')).openLibarchive(file)
  throw new Error(`${format} files don't have pages`)
}
