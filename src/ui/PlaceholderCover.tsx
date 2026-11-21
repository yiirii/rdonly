import type { BookTag } from '../core/tags'
import { TAG_COLOURS } from './motion'

/** Flat generated cover: solid tag colour, a few hard-edged shapes, the title in serif. */
export function PlaceholderCover({ title, tag }: { title: string; tag: BookTag }) {
  const c = TAG_COLOURS[tag]
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const r = 18 + (h % 26), x = 20 + ((h >> 5) % 50), y = 30 + ((h >> 9) % 40)
  return (
    <div className="placeholder-cover" style={{ background: c }}>
      <svg viewBox="0 0 100 150" aria-hidden="true">
        <circle cx={x} cy={y} r={r} fill="#000" opacity="0.14" />
        <rect x="0" y="112" width="100" height="38" fill="#000" opacity="0.18" />
        <rect x="10" y="104" width="34" height="3" fill="#fff" opacity="0.5" />
      </svg>
      <span>{title}</span>
    </div>
  )
}
