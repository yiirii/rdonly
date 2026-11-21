export interface ReadingTheme { id: 'paper' | 'sepia' | 'night' | 'oled'; name: string; bg: string; fg: string; link: string; selection: string; tone: 'light' | 'dark' }

/** Starter set (v0.2). Contrast is kept between 7 and 15: crisp but never glaring. */
export const READING_THEMES: ReadingTheme[] = [
  { id: 'paper', name: 'Paper', bg: '#f4efe4', fg: '#2b2722', link: '#7a4b1c', selection: '#e5d6b8', tone: 'light' },
  { id: 'sepia', name: 'Sepia', bg: '#e9dcc3', fg: '#3b2f22', link: '#7a4b1c', selection: '#d6c19a', tone: 'light' },
  { id: 'night', name: 'Night', bg: '#1c1d21', fg: '#cfcac0', link: '#9fb4e6', selection: '#3a3d46', tone: 'dark' },
  { id: 'oled', name: 'OLED', bg: '#000000', fg: '#a9a49a', link: '#8ea2d0', selection: '#2a2c33', tone: 'dark' },
]
export const themeById = (id: string) => READING_THEMES.find((t) => t.id === id) ?? READING_THEMES[2]

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
