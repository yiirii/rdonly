export type FontId = 'newsreader' | 'vollkorn' | 'spectral' | 'instrument' | 'funnel' | 'host' | 'atkinson' | 'book'
/** `scale` evens out how big each face looks at the same size setting. */
export interface ReadingFont { id: FontId; name: string; family: string; scale: number; kind: 'serif' | 'sans' | 'book' }

export const FONTS: ReadingFont[] = [
  { id: 'newsreader', name: 'Newsreader', family: "'Newsreader', Georgia, serif", scale: 1.04, kind: 'serif' },
  { id: 'vollkorn', name: 'Vollkorn', family: "'Vollkorn', Georgia, serif", scale: 1, kind: 'serif' },
  { id: 'spectral', name: 'Spectral', family: "'Spectral', Georgia, serif", scale: 1, kind: 'serif' },
  { id: 'instrument', name: 'Instrument Sans', family: "'Instrument Sans', system-ui, sans-serif", scale: 1, kind: 'sans' },
  { id: 'funnel', name: 'Funnel Sans', family: "'Funnel Sans', system-ui, sans-serif", scale: 0.98, kind: 'sans' },
  { id: 'host', name: 'Host Grotesk', family: "'Host Grotesk', system-ui, sans-serif", scale: 0.97, kind: 'sans' },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', family: "'Atkinson Hyperlegible Next', system-ui, sans-serif", scale: 0.98, kind: 'sans' },
  { id: 'book', name: 'Book’s own', family: '', scale: 1, kind: 'book' },
]
export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0]
