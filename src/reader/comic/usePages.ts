import { useEffect, useRef, useState } from 'react'
import { openPageSource, type PageSource } from '../../archive/pageSource'
import type { BookFormat } from '../../core/formats'

export type PageState = { url: string } | { error: true } | undefined

/** Opens the archive and keeps decoded pages only near the reading position. */
export function usePages(file: Blob, format: BookFormat, wanted: number[], keep: number[]) {
  const [src, setSrc] = useState<PageSource | null>(null)
  const [failed, setFailed] = useState(false)
  const [pages, setPages] = useState<Record<number, PageState>>({})
  const loading = useRef(new Set<number>())
  const urls = useRef(new Map<number, string>())

  useEffect(() => {
    let alive = true, opened: PageSource | undefined
    openPageSource(file, format).then((s) => { opened = s; if (alive) setSrc(s); else s.close() }, () => alive && setFailed(true))
    return () => {
      alive = false; opened?.close()
      for (const u of urls.current.values()) URL.revokeObjectURL(u)
      urls.current.clear()
    }
  }, [file, format])

  const wantKey = wanted.join(','), keepKey = keep.join(',')
  useEffect(() => {
    if (!src) return
    for (const i of wanted) {
      if (i < 0 || i >= src.count || urls.current.has(i) || loading.current.has(i)) continue
      loading.current.add(i)
      src.page(i).then(
        (b) => { const u = URL.createObjectURL(b); urls.current.set(i, u); setPages((p) => ({ ...p, [i]: { url: u } })) },
        () => setPages((p) => ({ ...p, [i]: { error: true } })),
      ).finally(() => loading.current.delete(i))
    }
    // Let go of pages far from where we are.
    const keepSet = new Set(keep)
    let dropped = false
    for (const [i, u] of urls.current) if (!keepSet.has(i)) { URL.revokeObjectURL(u); urls.current.delete(i); dropped = true }
    if (dropped) setPages((p) => Object.fromEntries(Object.entries(p).filter(([k]) => keepSet.has(Number(k)))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, wantKey, keepKey])

  return { count: src?.count ?? 0, ready: !!src, failed, pages }
}
