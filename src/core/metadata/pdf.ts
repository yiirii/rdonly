import type { BookMeta } from './types'

/** Browser-only: pdf.js is loaded lazily so the library screen stays light. */
export async function pdfMeta(bytes: Uint8Array): Promise<BookMeta> {
  const pdfjs = await (await import('../../archive/pdfjs')).pdfjs()
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const doc = await task.promise
  try {
    const info = ((await doc.getMetadata()).info ?? {}) as { Title?: string; Author?: string }
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: 600 / base.height })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
    const cover = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    return { title: info.Title?.trim() || undefined, author: info.Author?.trim() || undefined, cover: cover ?? undefined }
  } finally { await task.destroy() }
}
