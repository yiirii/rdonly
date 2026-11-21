import { unzipSync, strFromU8 } from 'fflate'

export type BookFormat = 'epub' | 'pdf' | 'cbz'

export const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''

/** Decide format from file bytes; the extension only labels damaged zips. */
export function detectFormat(fileName: string, bytes: Uint8Array): BookFormat | null {
  if (bytes.length < 4) return null
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf' // %PDF
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null // PK
  let names: string[]
  let mimetype: string | undefined
  try {
    const files = unzipSync(bytes, { filter: (f) => { (names ??= []).push(f.name); return f.name === 'mimetype' } })
    names ??= []
    if (files.mimetype) mimetype = strFromU8(files.mimetype).trim()
  } catch {
    const e = ext(fileName)
    return e === 'epub' ? 'epub' : e === 'cbz' ? 'cbz' : null
  }
  if (mimetype === 'application/epub+zip') return 'epub'
  if (names.some((n) => IMAGE_RE.test(n))) return 'cbz'
  return null
}
