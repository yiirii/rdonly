export const mimeFor = (path: string) => {
  const e = path.toLowerCase().split('.').pop()
  return e === 'jpg' || e === 'jpeg' ? 'image/jpeg' : e === 'png' ? 'image/png' : e === 'webp' ? 'image/webp'
    : e === 'gif' ? 'image/gif' : e === 'avif' ? 'image/avif' : 'application/octet-stream'
}
export const blobOf = (bytes: Uint8Array, type: string) => new Blob([bytes as unknown as BlobPart], { type })
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
export const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
export const clean = (s: string | null | undefined) => { const t = s?.replace(/\s+/g, ' ').trim(); return t || undefined }
export const num = (s: string | null | undefined) => { const n = s ? parseFloat(s) : NaN; return Number.isFinite(n) ? n : undefined }
/** Namespace-agnostic element lookup (works for dc:title, opf:meta, etc.). */
export const byLocal = (doc: Document | Element, local: string) =>
  Array.from(doc.getElementsByTagName('*')).filter((e) => e.localName === local)
