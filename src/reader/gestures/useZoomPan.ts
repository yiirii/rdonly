import { useCallback, useEffect, useRef, useState } from 'react'
import { clampPan, zoomAt, type Xform } from './math'

const ID: Xform = { x: 0, y: 0, s: 1 }
const LIMITS = { min: 1, max: 4 }
const DOUBLE_TAP_MS = 280

interface Opts {
  /** A single tap that wasn't part of a double tap (view coordinates). */
  onTap(x: number, y: number): void
  /** A horizontal swipe while not zoomed; dx is the drag distance. */
  onSwipe(dx: number): void
  /** Wheel without Ctrl while not zoomed (e.g. page turning). */
  onWheel?(e: WheelEvent): void
  /** Zoom resets whenever this changes (e.g. the page). */
  resetKey: unknown
}

/** Pinch, double-tap, drag-to-pan and Ctrl+wheel zoom, all as one transform. */
export function useZoomPan({ onTap, onSwipe, onWheel, resetKey }: Opts) {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState<Xform>(ID)
  const [live, setLive] = useState(false) // finger down: follow it exactly, no easing
  const tRef = useRef(t); tRef.current = t
  const cb = useRef({ onTap, onSwipe, onWheel }); cb.current = { onTap, onSwipe, onWheel }

  useEffect(() => { setT(ID) }, [resetKey])

  const view = () => { const el = ref.current; return { w: el?.clientWidth ?? innerWidth, h: el?.clientHeight ?? innerHeight } }
  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current?.getBoundingClientRect()
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
  }
  const settle = useCallback((n: Xform) => { const v = view(); setT(n.s <= 1.01 ? ID : clampPan(n, v, v)) }, [])

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<{ x: number; y: number; t: Xform; dist?: number; mid?: { x: number; y: number }; moved: boolean; pinched: boolean } | null>(null)
  const lastTap = useRef<{ at: number; x: number; y: number; middle: boolean } | null>(null)
  const pendingTap = useRef<ReturnType<typeof setTimeout>>()

  const onPointerDown = (e: React.PointerEvent) => {
    try { ref.current?.setPointerCapture?.(e.pointerId) } catch { /* pointer already gone */ }
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 1) start.current = { x: p.x, y: p.y, t: tRef.current, moved: false, pinched: false }
    if (pointers.current.size === 2 && start.current) {
      const [a, b] = [...pointers.current.values()]
      start.current = { ...start.current, t: tRef.current, dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pinched: true }
      setLive(true)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const s = start.current
    if (pointers.current.size >= 2 && s.dist && s.mid) {
      const [a, b] = [...pointers.current.values()]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const z = zoomAt(s.t, s.mid, Math.hypot(a.x - b.x, a.y - b.y) / s.dist, { min: 0.8, max: 5 })
      setT({ ...z, x: z.x + mid.x - s.mid.x, y: z.y + mid.y - s.mid.y })
      return
    }
    const dx = p.x - s.x, dy = p.y - s.y
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) s.moved = true
    if (s.moved && s.t.s > 1.01) { setLive(true); setT({ ...s.t, x: s.t.x + dx, y: s.t.y + dy }) }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const had = pointers.current.delete(e.pointerId)
    const s = start.current
    if (!had || !s) return
    if (pointers.current.size > 0) return // still pinching with the other finger
    start.current = null
    setLive(false)
    const p = local(e)
    if (s.pinched || (s.moved && s.t.s > 1.01)) { settle(tRef.current); return }
    const dx = p.x - s.x
    if (s.moved) { if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(p.y - s.y)) cb.current.onSwipe(dx); return }

    // A tap. In the middle third, wait briefly to see if it's a double tap.
    const v = view()
    const middle = p.x > v.w / 3 && p.x < (v.w * 2) / 3
    const zoomed = tRef.current.s > 1.01
    const now = performance.now()
    const prev = lastTap.current
    // Double tap only in the middle (or when zoomed), so quick taps on the edges turn pages.
    if (prev && (middle || zoomed) && (prev.middle || zoomed) && now - prev.at < DOUBLE_TAP_MS && Math.hypot(p.x - prev.x, p.y - prev.y) < 40) {
      clearTimeout(pendingTap.current); lastTap.current = null
      settle(zoomed ? ID : zoomAt(tRef.current, p, 2.5, LIMITS))
      return
    }
    lastTap.current = { at: now, x: p.x, y: p.y, middle }
    if (middle || zoomed) {
      clearTimeout(pendingTap.current)
      pendingTap.current = setTimeout(() => { if (!zoomed || middle) cb.current.onTap(p.x, p.y) }, DOUBLE_TAP_MS)
    } else cb.current.onTap(p.x, p.y)
  }

  /** A cancelled touch (system gesture, notification pull) is never a tap or a swipe. */
  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) return
    const s = start.current
    start.current = null
    setLive(false)
    if (s && (s.pinched || s.t.s > 1.01)) settle(tRef.current)
  }

  // Wheel needs a non-passive listener so Ctrl+wheel doesn't zoom the whole window.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      const cur = tRef.current
      if (e.ctrlKey) {
        e.preventDefault()
        settle(zoomAt(cur, local(e), Math.exp(-e.deltaY / 300), LIMITS))
      } else if (cur.s > 1.01) {
        e.preventDefault()
        settle({ ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY })
      } else cb.current.onWheel?.(e)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [settle])

  useEffect(() => () => clearTimeout(pendingTap.current), [])

  return {
    ref,
    zoomed: t.s > 1.01,
    reset: () => setT(ID),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style: {
      transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s})`,
      transformOrigin: '0 0',
      transition: live ? 'none' : 'transform 240ms cubic-bezier(.2,.8,.2,1)',
    } as React.CSSProperties,
  }
}
