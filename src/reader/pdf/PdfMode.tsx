import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdf } from '../../archive/pdfjs'
import type { ReaderModeProps } from '../types'

const parse = (loc?: string) => { const m = loc?.match(/^page:(\d+):?([\d.]*)/); return m ? { page: Number(m[1]), frac: Number(m[2] || 0) } : { page: 0, frac: 0 } }
const GAP = 12

/** Documents: one continuous column of pages, fit to width, drawn only near the screen. */
export function PdfMode({ file, initial, onProgress, chrome }: ReaderModeProps) {
  const box = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy>()
  const [failed, setFailed] = useState(false)
  const [ratios, setRatios] = useState<Record<number, number>>({})
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [anchor, setAnchor] = useState(() => parse(initial?.locator))
  const programmatic = useRef(false)
  const scrolling = useRef(false)
  const idle = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    let alive = true, destroy: (() => void) | undefined
    openPdf(file).then(({ task, doc }) => {
      destroy = () => void task.destroy()
      if (!alive) return destroy()
      setDoc(doc)
      void doc.getPage(1).then((p) => { const v = p.getViewport({ scale: 1 }); setRatios((r) => ({ ...r, 0: v.height / v.width })) })
    }, () => alive && setFailed(true))
    return () => { alive = false; destroy?.() }
  }, [file])

  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setWidth(Math.min(el.clientWidth - 24, 900)))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  const count = doc?.numPages ?? 0
  const pageW = Math.round(width * zoom)
  const fallback = ratios[0] ?? 1.414
  const heights = useMemo(() => Array.from({ length: count }, (_, i) => Math.round(pageW * (ratios[i] ?? fallback))), [count, pageW, ratios, fallback])
  const tops = useMemo(() => { const t = [GAP]; for (const h of heights) t.push(t[t.length - 1] + h + GAP); return t }, [heights])

  // Hold the reading position while sizes settle or zoom changes.
  useLayoutEffect(() => {
    const el = box.current
    if (!el || !pageW || !count || scrolling.current) return
    const want = Math.max(0, Math.round(tops[anchor.page] - GAP + heights[anchor.page] * anchor.frac))
    if (Math.abs(el.scrollTop - want) > 2) { programmatic.current = true; el.scrollTop = want }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tops, pageW, count])

  const onScroll = useCallback(() => {
    const el = box.current
    if (!el || !count) return
    if (programmatic.current) { programmatic.current = false; return }
    scrolling.current = true
    clearTimeout(idle.current); idle.current = setTimeout(() => { scrolling.current = false }, 150)
    const y = el.scrollTop + 1
    let i = 0
    while (i < count - 1 && tops[i + 1] <= y) i++
    const frac = Math.min(1, Math.max(0, (y - tops[i]) / heights[i]))
    setAnchor((a) => (a.page === i && Math.abs(a.frac - frac) < 0.01 ? a : { page: i, frac }))
  }, [count, tops, heights])

  useEffect(() => {
    if (!count) return
    onProgress({ locator: `page:${anchor.page}:${anchor.frac.toFixed(3)}`, percent: (anchor.page + 1) / count, label: `${anchor.page + 1} / ${count}` })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.page, Math.round(anchor.frac * 100), count])

  // Ctrl+wheel / pinch zoom (re-lays out the pages; scrolling stays native).
  useEffect(() => {
    const el = box.current!
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoom((z) => Math.min(3, Math.max(1, z * Math.exp(-e.deltaY / 300))))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const tap = useRef<{ x: number; y: number; at: number } | null>(null)
  const lastTap = useRef(0)

  const near = new Set<number>()
  for (let k = anchor.page - 2; k <= anchor.page + 3; k++) if (k >= 0 && k < count) near.add(k)

  if (failed) return <div className="reader-note"><h2>This PDF couldn’t be opened</h2><p>The file may be damaged. Try importing it again.</p></div>
  return (
    <div className="pdf" data-testid="pdf" data-zoom={zoom.toFixed(2)} ref={box} onScroll={onScroll}
      onPointerDown={(e) => {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (touches.current.size === 2) { const [a, b] = [...touches.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom } }
        tap.current = { x: e.clientX, y: e.clientY, at: performance.now() }
      }}
      onPointerMove={(e) => {
        if (!touches.current.has(e.pointerId)) return
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinch.current && touches.current.size === 2) {
          const [a, b] = [...touches.current.values()]
          setZoom(Math.min(3, Math.max(1, pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d)))
        }
      }}
      onPointerUp={(e) => {
        touches.current.delete(e.pointerId)
        if (touches.current.size < 2) pinch.current = null
        const t = tap.current; tap.current = null
        if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8 || performance.now() - t.at > 350) return
        const now = performance.now()
        if (now - lastTap.current < 280) { lastTap.current = 0; setZoom((z) => (z > 1.05 ? 1 : 2)); return }
        lastTap.current = now
        setTimeout(() => { if (lastTap.current === now) chrome.toggle() }, 280)
      }}
      onPointerCancel={(e) => { touches.current.delete(e.pointerId); pinch.current = null }}>
      <div className="pdf-column" style={{ height: tops[count] ?? '100%', width: pageW || '100%' }}>
        {doc && Array.from({ length: count }, (_, i) => (
          <div key={i} className="pdf-page" data-testid="pdf-page" data-page={i} style={{ top: tops[i], height: heights[i] }}>
            {near.has(i) && pageW > 0 && <PdfCanvas doc={doc} index={i} width={pageW}
              onRatio={(r) => setRatios((s) => (Math.abs((s[i] ?? 0) - r) < 0.001 ? s : { ...s, [i]: r }))} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function PdfCanvas({ doc, index, width, onRatio }: { doc: PDFDocumentProxy; index: number; width: number; onRatio(r: number): void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task: { cancel(): void; promise: Promise<void> } | undefined
    void doc.getPage(index + 1).then((page) => {
      if (cancelled || !ref.current) return
      const base = page.getViewport({ scale: 1 })
      onRatio(base.height / base.width)
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const vp = page.getViewport({ scale: (width / base.width) * dpr })
      const c = ref.current
      c.width = Math.round(vp.width); c.height = Math.round(vp.height)
      task = page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp })
      task.promise.catch(() => {})
    })
    return () => { cancelled = true; task?.cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, index, width])
  return <canvas ref={ref} />
}
