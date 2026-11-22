import newsreader from '@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url'
import newsreaderI from '@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2?url'
import vollkorn400 from '@fontsource/vollkorn/files/vollkorn-latin-400-normal.woff2?url'
import vollkorn400i from '@fontsource/vollkorn/files/vollkorn-latin-400-italic.woff2?url'
import vollkorn700 from '@fontsource/vollkorn/files/vollkorn-latin-700-normal.woff2?url'
import spectral400 from '@fontsource/spectral/files/spectral-latin-400-normal.woff2?url'
import spectral400i from '@fontsource/spectral/files/spectral-latin-400-italic.woff2?url'
import spectral700 from '@fontsource/spectral/files/spectral-latin-700-normal.woff2?url'
import instrument400 from '@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff2?url'
import instrument400i from '@fontsource/instrument-sans/files/instrument-sans-latin-400-italic.woff2?url'
import instrument700 from '@fontsource/instrument-sans/files/instrument-sans-latin-700-normal.woff2?url'
import funnel400 from '@fontsource/funnel-sans/files/funnel-sans-latin-400-normal.woff2?url'
import funnel400i from '@fontsource/funnel-sans/files/funnel-sans-latin-400-italic.woff2?url'
import funnel700 from '@fontsource/funnel-sans/files/funnel-sans-latin-700-normal.woff2?url'
import host400 from '@fontsource/host-grotesk/files/host-grotesk-latin-400-normal.woff2?url'
import host400i from '@fontsource/host-grotesk/files/host-grotesk-latin-400-italic.woff2?url'
import host700 from '@fontsource/host-grotesk/files/host-grotesk-latin-700-normal.woff2?url'
import atk400 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff2?url'
import atk400i from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-italic.woff2?url'
import atk700 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2?url'

export { FONTS, fontById, type FontId } from './fontList'

const abs = (u: string) => new URL(u, location.href).href
const face = (family: string, url: string, weight: string | number, style = 'normal') =>
  `@font-face{font-family:'${family}';src:url('${abs(url)}') format('woff2');font-weight:${weight};font-style:${style};font-display:swap}`

/** @font-face rules with absolute URLs, so they also work inside the book's own frame. */
export const fontFaces = () => [
  face('Newsreader', newsreader, '200 800'), face('Newsreader', newsreaderI, '200 800', 'italic'),
  face('Vollkorn', vollkorn400, 400), face('Vollkorn', vollkorn400i, 400, 'italic'), face('Vollkorn', vollkorn700, 700),
  face('Spectral', spectral400, 400), face('Spectral', spectral400i, 400, 'italic'), face('Spectral', spectral700, 700),
  face('Instrument Sans', instrument400, 400), face('Instrument Sans', instrument400i, 400, 'italic'), face('Instrument Sans', instrument700, 700),
  face('Funnel Sans', funnel400, 400), face('Funnel Sans', funnel400i, 400, 'italic'), face('Funnel Sans', funnel700, 700),
  face('Host Grotesk', host400, 400), face('Host Grotesk', host400i, 400, 'italic'), face('Host Grotesk', host700, 700),
  face('Atkinson Hyperlegible Next', atk400, 400), face('Atkinson Hyperlegible Next', atk400i, 400, 'italic'), face('Atkinson Hyperlegible Next', atk700, 700),
].join('\n')
