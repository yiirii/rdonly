import literata400 from '@fontsource/literata/files/literata-latin-400-normal.woff2?url'
import literata400i from '@fontsource/literata/files/literata-latin-400-italic.woff2?url'
import literata700 from '@fontsource/literata/files/literata-latin-700-normal.woff2?url'
import lora400 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url'
import lora400i from '@fontsource/lora/files/lora-latin-400-italic.woff2?url'
import lora700 from '@fontsource/lora/files/lora-latin-700-normal.woff2?url'
import atk400 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url'
import atk400i from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff2?url'
import atk700 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2?url'

export type FontId = 'literata' | 'lora' | 'atkinson' | 'book'
export const FONTS: { id: FontId; name: string; family: string }[] = [
  { id: 'literata', name: 'Literata', family: "'Literata', Georgia, serif" },
  { id: 'lora', name: 'Lora', family: "'Lora', Georgia, serif" },
  { id: 'atkinson', name: 'Atkinson', family: "'Atkinson Hyperlegible', system-ui, sans-serif" },
  { id: 'book', name: 'Book’s own', family: '' },
]

const abs = (u: string) => new URL(u, location.href).href
const face = (family: string, url: string, weight: number, style = 'normal') =>
  `@font-face{font-family:'${family}';src:url('${abs(url)}') format('woff2');font-weight:${weight};font-style:${style};font-display:swap}`

/** @font-face rules with absolute URLs, so they work inside the book's own frame. */
export const fontFaces = () => [
  face('Literata', literata400, 400), face('Literata', literata400i, 400, 'italic'), face('Literata', literata700, 700),
  face('Lora', lora400, 400), face('Lora', lora400i, 400, 'italic'), face('Lora', lora700, 700),
  face('Atkinson Hyperlegible', atk400, 400), face('Atkinson Hyperlegible', atk400i, 400, 'italic'), face('Atkinson Hyperlegible', atk700, 700),
].join('\n')
