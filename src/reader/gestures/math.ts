export interface Xform { x: number; y: number; s: number }
type Size = { w: number; h: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Scale by `factor` around `p` (view coordinates) so the content under p stays put. */
export function zoomAt(t: Xform, p: { x: number; y: number }, factor: number, limits: { min: number; max: number }): Xform {
  const s = clamp(t.s * factor, limits.min, limits.max)
  const cx = (p.x - t.x) / t.s, cy = (p.y - t.y) / t.s
  return { x: p.x - cx * s, y: p.y - cy * s, s }
}

/** Keep the scaled content covering the view: no empty edges. Origin-anchored transform (translate then scale). */
export function clampPan(t: Xform, view: Size, content: Size): Xform {
  const w = content.w * t.s, h = content.h * t.s
  const x = w <= view.w ? (view.w - w) / 2 : clamp(t.x, view.w - w, 0)
  const y = h <= view.h ? (view.h - h) / 2 : clamp(t.y, view.h - h, 0)
  return { x: x + 0, y: y + 0, s: t.s }
}
