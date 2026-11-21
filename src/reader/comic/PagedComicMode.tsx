import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { modeFor } from '../modes'
import type { ReaderModeProps } from '../types'
import { buildSpreads, spreadFor } from './layout'
import { usePages } from './usePages'
import { useZoomPan } from '../gestures/useZoomPan'

const pageFrom = (locator?: string) => { const m = locator?.match(/^page:(\d+)/); return m ? Number(m[1]) : 0 }

function useWide() {
  const q = '(min-width: 900px) and (orientation: landscape)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => { const m = matchMedia(q); const h = () => setWide(m.matches); m.addEventListener('change', h); return () => m.removeEventListener('change', h) }, [])
  return wide
}

export function PagedComicMode({ book, file, initial, onProgress, chrome }: ReaderModeProps) {
  const rtl = modeFor(book) === 'paged-rtl'
  const double = useWide()
  const reduce = useReducedMotion()
  const [sizes, setSizes] = useState<Record<number, { w: number; h: number }>>({})
  const [page, setPage] = useState(() => pageFrom(initial?.locator))
  const [dir, setDir] = useState(1)

  const near = (from: number, span: number) => Array.from({ length: span * 2 + 2 }, (_, k) => from - span + k)
  const { count, ready, failed, pages } = usePages(file, book.format, near(page, 4), near(page, 8))

  const spreads = useMemo(
    () => buildSpreads(Array.from({ length: count }, (_, i) => sizes[i]), { double, coverAlone: true }),
    [count, sizes, double],
  )
  const idx = spreadFor(spreads, page)
  const spread = spreads[idx] ?? []

  useEffect(() => {
    if (!spread.length) return
    const first = spread[0], last = spread[spread.length - 1]
    onProgress({
      locator: `page:${first}`, percent: (last + 1) / count,
      label: first === last ? `${first + 1} / ${count}` : `${first + 1}–${last + 1} / ${count}`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread.join(','), count])

  const go = useCallback((delta: number) => {
    const next = spreads[idx + delta]
    if (!next) return
    setDir(delta); setPage(next[0])
  }, [spreads, idx])

  // Keys: the arrow pointing the way you read goes forward.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowRight') go(rtl ? -1 : 1)
      else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1)
      else if (e.key === ' ' || e.key === 'PageDown') go(1)
      else if (e.key === 'PageUp') go(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go, rtl])

  // Gestures: outer thirds turn (mirrored for manga), middle toggles the bars, swipes turn,
  // double-tap / pinch / Ctrl+wheel zoom, plain wheel turns pages on the laptop.
  const wheelAt = useRef(0)
  const zoom = useZoomPan({
    resetKey: idx,
    onTap: (x) => {
      const third = x / window.innerWidth
      if (third < 1 / 3) go(rtl ? 1 : -1)
      else if (third > 2 / 3) go(rtl ? -1 : 1)
      else chrome.toggle()
    },
    onSwipe: (dx) => go((dx < 0) !== rtl ? 1 : -1),
    onWheel: (e) => {
      if (Math.abs(e.deltaY) < 20 || performance.now() - wheelAt.current < 350) return
      wheelAt.current = performance.now(); go(e.deltaY > 0 ? 1 : -1)
    },
  })

  // New pages slide in from the side you're reading towards.
  const enterFrom = dir * (rtl ? -1 : 1)
  const variants = {
    enter: (s: number) => (reduce ? { opacity: 0 } : { x: `${s * 28}%`, opacity: 0 }),
    center: { x: '0%', opacity: 1 },
    exit: (s: number) => (reduce ? { opacity: 0 } : { x: `${-s * 28}%`, opacity: 0 }),
  }

  if (failed) return <div className="reader-note comic-error"><h2>This comic couldn’t be opened</h2><p>The file may be damaged. Try importing it again.</p></div>
  return (
    <div className="comic" data-testid="comic" data-dir={rtl ? 'rtl' : 'ltr'} ref={zoom.ref} {...zoom.handlers}>
      <div className="comic-zoom" data-testid="comic-zoom" style={zoom.style}>
      <AnimatePresence initial={false} custom={enterFrom}>
        {ready && (
          <SpreadFrame key={idx} double={spread.length > 1} rtl={rtl} custom={enterFrom} variants={variants}>
            {spread.map((i) => {
              const p = pages[i]
              return (
                <div key={i} className="comic-page" data-testid="comic-page" data-page={i}>
                  {p && 'url' in p ? (
                    <img src={p.url} alt={`Page ${i + 1}`} draggable={false}
                      onLoad={(e) => { const im = e.currentTarget; if (!sizes[i]) setSizes((s) => ({ ...s, [i]: { w: im.naturalWidth, h: im.naturalHeight } })) }} />
                  ) : p && 'error' in p ? (
                    <div className="page-error" data-testid="page-error"><span>Page {i + 1} couldn’t be read</span></div>
                  ) : <div className="page-loading" />}
                </div>
              )
            })}
          </SpreadFrame>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

/** One spread on screen; marks itself as no longer current while it slides away. */
function SpreadFrame({ double, rtl, custom, variants, children }: {
  double: boolean; rtl: boolean; custom: number; variants: import('framer-motion').Variants; children: ReactNode
}) {
  const present = useIsPresent()
  return (
    <motion.div className={`comic-spread ${double ? 'double' : ''}`} data-testid="comic-spread" data-current={present ? 'true' : 'false'}
      custom={custom} variants={variants} initial="enter" animate="center" exit="exit"
      transition={{ type: 'spring', stiffness: 520, damping: 46, mass: 0.7, opacity: { duration: 0.16 } }}
      style={{ flexDirection: rtl ? 'row-reverse' : 'row', pointerEvents: present ? 'auto' : 'none' }}>
      {children}
    </motion.div>
  )
}
