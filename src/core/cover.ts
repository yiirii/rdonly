const MAX_W = 300
const MAX_BYTES = 40_000

const encode = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((r) => c.toBlob(r, type, q))

/** Shrink a cover to ≤300px wide and ≤40KB. WebP where supported, JPEG otherwise (older Safari). */
export async function makeThumb(cover: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(cover)
  const scale = Math.min(1, MAX_W / bmp.width)
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  let best: Blob | null = null
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      const b = await encode(c, type, q)
      if (!b || b.type !== type) break // encoder unsupported → try next type
      best = b
      if (b.size <= MAX_BYTES) return b
    }
  }
  if (best) return best
  throw new Error('Could not encode a cover thumbnail')
}

export const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b)
})
