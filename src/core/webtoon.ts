/** Webtoons are long vertical strips: median page height at least 2.5× its width. */
export function looksLikeWebtoon(sizes: { w: number; h: number }[]): boolean {
  if (!sizes.length) return false
  const r = sizes.map((s) => s.h / s.w).sort((a, b) => a - b)
  const m = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2
  return m >= 2.5
}

/** Browser only: sizes of the first few pages, read from the images themselves. */
export async function firstPageSizes(file: Blob, format: import('./formats').BookFormat, n = 5): Promise<{ w: number; h: number }[]> {
  const { openPageSource } = await import('../archive/pageSource')
  const src = await openPageSource(file, format)
  try {
    const out: { w: number; h: number }[] = []
    for (let i = 0; i < Math.min(n, src.count); i++) {
      try { const b = await createImageBitmap(await src.page(i)); out.push({ w: b.width, h: b.height }); b.close() } catch { /* skip unreadable page */ }
    }
    return out
  } finally { src.close() }
}
