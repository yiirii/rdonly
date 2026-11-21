import { zipSync } from 'fflate'
import { IMAGE_RE } from '../core/formats'
import { naturalCompare } from '../core/metadata/util'
import type { ImportItem } from './importBooks'

const folderName = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] || 'Comic'

/** A picked folder of images becomes one CBZ (stored, not recompressed), named after the folder. */
export function folderToCbz(files: File[]): ImportItem | null {
  const pages = files.filter((f) => IMAGE_RE.test(f.name) && !f.name.startsWith('.')).sort((a, b) => naturalCompare(a.name, b.name))
  if (!pages.length) return null
  return {
    name: `${folderName(pages[0])}.cbz`,
    async read() {
      const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
      for (const p of pages) entries[p.name] = [new Uint8Array(await p.arrayBuffer()), { level: 0 }]
      return zipSync(entries)
    },
  }
}
