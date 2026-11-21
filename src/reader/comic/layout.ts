export type Spread = number[]
type Size = { w: number; h: number } | undefined

const isWide = (s: Size) => !!s && s.w > s.h

/** Group pages into what's shown together. Wide pages (already a two-page spread) always stand alone. */
export function buildSpreads(sizes: Size[], opts: { double: boolean; coverAlone: boolean }): Spread[] {
  const out: Spread[] = []
  let i = 0
  if (opts.double && opts.coverAlone && sizes.length) out.push([i++])
  while (i < sizes.length) {
    if (!opts.double || isWide(sizes[i]) || i + 1 >= sizes.length || isWide(sizes[i + 1])) { out.push([i++]); continue }
    out.push([i, i + 1]); i += 2
  }
  return out
}

export function spreadFor(spreads: Spread[], page: number): number {
  const i = spreads.findIndex((s) => s.includes(page))
  if (i >= 0) return i
  return Math.max(0, spreads.length - 1)
}
