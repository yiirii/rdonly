import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReaderModeProps } from '../types'
import { usePages } from './usePages'

const parse = (loc?: string) => {
  const m = loc?.match(/^(?:scroll|page):(\d+):?([\d.]*)/) // also accepts the paged reader's position
  return m ? { page: Number(m[1]), frac: Number(m[2] || 0) } : { page: 0, frac: 0 }
}

/** One continuous vertical strip. Pages near the screen are decoded; the rest are sized placeholders. */
export function WebtoonMode({ book, file, initial, onProgress, chrome, onError }: ReaderModeProps) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [ratios, setRatios] = useState<Record<number, number>>({}) // h / w, learned as pages load
  const [anchor, setAnchor] = useState(() => parse(initial?.locator))
  const programmatic = useRef(false) // our own scroll jumps aren't the reader scrolling

  const { count, pages, failed, ready, markError } = usePages(file, book.format, range(anchor.page - 2, anchor.page + 3), range(anchor.page - 5, anchor.page + 6))

  const known = Object.values(ratios)
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 3
  const heights = useMemo(() => Array.from({ length: count }, (_, i) => Math.round(width * (ratios[i] ?? avg))), [count, width, ratios, avg])
  const tops = useMemo(() => { const t = [0]; for (const h of heights) t.push(t[t.length - 1] + h); return t }, [heights])

  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setWidth(el.querySelector('.webtoon-strip')!.clientWidth))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // Keep the reading position fixed while page heights above it settle (and on first open).
  useLayoutEffect(() => {
    const el = box.current
    if (!el || !width || !count) return
    const want = Math.round(tops[anchor.page] + heights[anchor.page] * anchor.frac)
    if (!scrolling.current && Math.abs(el.scrollTop - want) > 2) { programmatic.current = true; el.scrollTop = want }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tops, width, count])

  const scrolling = useRef(false)
  const idle = useRef<ReturnType<typeof setTimeout>>()
  const onScroll = useCallback(() => {
    const el = box.current
    if (!el || !count) return
    if (programmatic.current) { programmatic.current = false; return }
    scrolling.current = true
    clearTimeout(idle.current); idle.current = setTimeout(() => { scrolling.current = false }, 150)
    const y = el.scrollTop
    let i = 0
    while (i < count - 1 && tops[i + 1] <= y) i++
    const frac = heights[i] ? Math.min(1, Math.max(0, (y - tops[i]) / heights[i])) : 0
    setAnchor((a) => (a.page === i && Math.abs(a.frac - frac) < 0.01 ? a : { page: i, frac }))
  }, [count, tops, heights])

  useEffect(() => {
    if (!count) return
    onProgress({ locator: `scroll:${anchor.page}:${anchor.frac.toFixed(3)}`, percent: Math.min(1, (anchor.page + anchor.frac) / count), label: `${anchor.page + 1} / ${count}` })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, count])

  useEffect(() => {
    if (failed) onError('The file may be damaged. Try importing it again.')
    else if (ready && count === 0) onError('There are no pages in this comic.')
  }, [failed, ready, count, onError])

  const down = useRef<{ x: number; y: number } | null>(null)
  return (
    <div className="webtoon" data-testid="webtoon" ref={box} onScroll={onScroll}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}
      onPointerUp={(e) => { const d = down.current; down.current = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) chrome.toggle() }}>
      <div className="webtoon-strip" style={{ height: tops[count] || '100%' }}>
        {Array.from({ length: count }, (_, i) => {
          const p = pages[i]
          return (
            <div key={i} className="webtoon-page" data-testid="webtoon-page" data-page={i} style={{ top: tops[i], height: heights[i] }}>
              {p && 'url' in p ? (
                <img src={p.url} alt={`Page ${i + 1}`} draggable={false} onError={() => markError(i)}
                  onLoad={(e) => { const im = e.currentTarget; const r = im.naturalHeight / im.naturalWidth; if (ratios[i] !== r) setRatios((s) => ({ ...s, [i]: r })) }} />
              ) : p && 'error' in p ? <div className="page-error" data-testid="page-error"><span>Page {i + 1} couldn’t be read</span></div> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k)
