import { describe, it, expect } from 'vitest'
import { zoomAt, clampPan } from '../../src/reader/gestures/math'

const view = { w: 400, h: 800 }
const contentAt = (t: { x: number; y: number; s: number }, p: { x: number; y: number }) => ({ x: (p.x - t.x) / t.s, y: (p.y - t.y) / t.s })

describe('zoomAt', () => {
  it('keeps the point under the finger fixed', () => {
    const t0 = { x: 0, y: 0, s: 1 }, p = { x: 100, y: 200 }
    const t1 = zoomAt(t0, p, 2, { min: 1, max: 4 })
    expect(t1.s).toBe(2)
    expect(contentAt(t1, p)).toEqual(contentAt(t0, p))
  })
  it('clamps the scale between 1 and 4', () => {
    expect(zoomAt({ x: 0, y: 0, s: 3 }, { x: 0, y: 0 }, 5, { min: 1, max: 4 }).s).toBe(4)
    expect(zoomAt({ x: 0, y: 0, s: 1.5 }, { x: 0, y: 0 }, 0.1, { min: 1, max: 4 }).s).toBe(1)
  })
})

describe('clampPan', () => {
  it('never shows past the page edges when zoomed', () => {
    expect(clampPan({ x: 50, y: 30, s: 2 }, view, view)).toEqual({ x: 0, y: 0, s: 2 })
    expect(clampPan({ x: -1000, y: -5000, s: 2 }, view, view)).toEqual({ x: -400, y: -800, s: 2 })
  })
  it('leaves a valid position alone', () => {
    expect(clampPan({ x: -100, y: -300, s: 2 }, view, view)).toEqual({ x: -100, y: -300, s: 2 })
  })
  it('snaps back to the origin at scale 1', () => {
    expect(clampPan({ x: -30, y: 12, s: 1 }, view, view)).toEqual({ x: 0, y: 0, s: 1 })
  })
})
