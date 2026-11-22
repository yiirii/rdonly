export interface ReadingTheme { id: string; name: string; bg: string; fg: string; link: string; selection: string; tone: 'light' | 'dark' }

const t = (id: string, name: string, bg: string, fg: string, link: string, selection: string, tone: 'light' | 'dark'): ReadingTheme =>
  ({ id, name, bg, fg, link, selection, tone })

/** Chosen with Justin (docs/design/theme-shortlist.png). Contrast kept 7–15: crisp, never glaring. */
export const READING_THEMES: ReadingTheme[] = [
  t('paper', 'Paper', '#f4efe4', '#2b2722', '#7a4b1c', '#e5d6b8', 'light'),
  t('linen', 'Linen', '#efebe5', '#33302c', '#5c4a36', '#ddd5c8', 'light'),
  t('sepia', 'Sepia', '#e9dcc3', '#3b2f22', '#7a4b1c', '#d6c19a', 'light'),
  t('parchment', 'Parchment', '#e2d0ab', '#3a2c18', '#6e4515', '#cfb782', 'light'),
  t('rose', 'Rose', '#f0e2dc', '#3a2926', '#8a3b3b', '#e2c8bf', 'light'),
  t('sage', 'Sage', '#dde4d3', '#2b3327', '#3f5e33', '#c4d0b6', 'light'),
  t('mist', 'Mist', '#e1e7ee', '#26303b', '#2f5a8a', '#c7d3e0', 'light'),
  t('dusk', 'Dusk', '#2b2734', '#d9d1c7', '#c3a9e6', '#433d52', 'dark'),
  t('slate', 'Slate', '#23282f', '#c8d0d8', '#92b4dc', '#3a424d', 'dark'),
  t('night', 'Night', '#1c1d21', '#cfcac0', '#9fb4e6', '#3a3d46', 'dark'),
  t('ink', 'Ink', '#131a25', '#c2cad6', '#8fb0e8', '#283447', 'dark'),
  t('forest', 'Forest', '#17201b', '#c6d1c2', '#9cc59a', '#2b3a30', 'dark'),
  t('ember', 'Ember', '#1d1714', '#d8b88e', '#e6a36b', '#3a2c22', 'dark'),
  t('oled', 'OLED', '#000000', '#a9a49a', '#8ea2d0', '#2a2c33', 'dark'),
]
export const themeById = (id: string) => READING_THEMES.find((x) => x.id === id) ?? READING_THEMES.find((x) => x.id === 'night')!

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
