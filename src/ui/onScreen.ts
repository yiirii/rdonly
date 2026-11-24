import { useLayoutEffect, useRef, type RefObject } from 'react'

/** One shared observer for every cover: tracks whether each is on screen (with a small margin). */
const seen = new WeakMap<Element, boolean>()
let io: IntersectionObserver | undefined
const observer = () => (io ??= new IntersectionObserver((es) => { for (const e of es) seen.set(e.target, e.isIntersecting) }, { rootMargin: '80px' }))

const inView = (el: Element) => { const r = el.getBoundingClientRect(); return r.bottom > -80 && r.top < innerHeight + 80 }

/**
 * `quiet.current` is true for a card that mounted off screen — it should skip its entrance (nobody sees it).
 * `visibleNow()` answers at exit time, so a card leaving off screen can skip its exit too.
 * Checked before paint, so on-screen cards look exactly as before.
 */
export function useOnScreen(ref: RefObject<Element | null>) {
  const quiet = useRef(false) // read by the entrance when it starts (after this layout effect), no extra render
  useLayoutEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === 'undefined') return
    const v = inView(el); seen.set(el, v); quiet.current = !v
    const o = observer(); o.observe(el)
    return () => o.unobserve(el)
  }, [ref])
  const visibleNow = useRef(() => { const el = ref.current; return !el || (seen.get(el) ?? true) }).current
  return { quiet, visibleNow }
}
