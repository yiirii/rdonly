/** Page turn as a short slide-and-fade (transform + opacity only). Overlapping turns skip ahead instead of queueing. */
export function createGlide(el: () => HTMLElement | null, reduceMotion: () => boolean) {
  let token = 0
  const settle = (e: HTMLElement) => e.getAnimations().forEach((a) => a.cancel())
  return async function glide(dir: 1 | -1, turn: () => Promise<unknown> | unknown) {
    const e = el()
    if (!e) { await turn(); return }
    const my = ++token
    const reduce = reduceMotion()
    const shift = reduce ? 0 : 28
    settle(e)
    const out = e.animate(
      [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * shift}px)`, opacity: 0 }],
      { duration: reduce ? 90 : 110, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
    )
    await out.finished.catch(() => {})
    await turn()
    if (my !== token) return // a newer turn took over; it owns the animation now
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    if (my !== token) return
    const inn = e.animate(
      [{ transform: `translateX(${dir * shift}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: reduce ? 140 : 200, easing: 'cubic-bezier(.15,.85,.25,1)' },
    )
    out.cancel()
    await inn.finished.catch(() => {})
    if (my === token) settle(e)
  }
}
