import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { settingsStore, useSettings, type Settings } from '../../state/settings'
import type { ReaderModeProps } from '../types'
import { FONTS, fontFaces } from './fonts'
import { ReadingSettings } from './ReadingSettings'
import { themeById } from './themes'

type FoliateView = HTMLElement & {
  open(f: Blob): Promise<void>; init(o: { lastLocation?: string; showTextStart?: boolean }): Promise<void>
  goLeft(): void; goRight(): void; goToFraction(f: number): Promise<void>; close(): void
  isFixedLayout: boolean; renderer: HTMLElement & { setStyles?(s: string): void }
}
type Relocate = { cfi: string; fraction: number; tocItem?: { label?: string } }

function bookCss(s: Pick<Settings, 'theme' | 'font' | 'fontSize'>) {
  const t = themeById(s.theme)
  const family = FONTS.find((f) => f.id === s.font)?.family
  return `${fontFaces()}
html { background: ${t.bg} !important; color: ${t.fg} !important; color-scheme: ${t.tone}; }
body { color: ${t.fg} !important; background: transparent !important; font-size: ${s.fontSize}% !important; line-height: 1.6;
  ${family ? `font-family: ${family} !important;` : ''} -webkit-font-smoothing: antialiased; }
${family ? `p, li, blockquote, dd, span, div { font-family: inherit !important; }` : ''}
p { hyphens: auto; -webkit-hyphens: auto; }
a:any-link { color: ${t.link} !important; }
::selection { background: ${t.selection}; }
img, svg { max-width: 100%; }`
}

/** Novels: foliate-js lays out the pages; we style them and drive navigation. */
export function NovelMode({ book, file, initial, onProgress, chrome, setChromeExtras, onError }: ReaderModeProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<FoliateView>()
  const [cfi, setCfi] = useState<string>()
  const [layout, setLayout] = useState<'reflow' | 'fixed'>()
  const [fraction, setFraction] = useState(initial?.percent ?? 0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const s = useSettings(useShallow((x) => ({ theme: x.theme, font: x.font, fontSize: x.fontSize })))
  const theme = themeById(s.theme)
  const toggle = useRef(chrome.toggle); toggle.current = chrome.toggle

  useEffect(() => { if (!settingsStore.getState().loaded) void settingsStore.getState().load() }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      await import('../../../vendor/foliate-js/view.js')
      if (!alive || !host.current) return
      const v = document.createElement('foliate-view') as FoliateView
      host.current.append(v)
      view.current = v
      // foliate decides the format from the name, so give the Blob one.
      await v.open(new File([file], `${book.id}.${book.format}`, { type: 'application/epub+zip' }))
      if (!alive) return
      const r = v.renderer
      if (!v.isFixedLayout) {
        r.setAttribute('flow', 'paginated'); r.setAttribute('animated', '')
        r.setAttribute('margin', '44px'); r.setAttribute('gap', '7%')
        r.setAttribute('max-inline-size', '640px'); r.setAttribute('max-column-count', '2')
      }
      setLayout(v.isFixedLayout ? 'fixed' : 'reflow')
      r.setStyles?.(bookCss(settingsStore.getState()))
      v.addEventListener('relocate', (e) => {
        const d = (e as CustomEvent<Relocate>).detail
        setCfi(d.cfi); setFraction(d.fraction)
        const chapter = d.tocItem?.label?.trim()
        onProgress({ locator: d.cfi, percent: d.fraction, label: `${chapter ? `${chapter} · ` : ''}${Math.round(d.fraction * 100)}%` })
      })
      v.addEventListener('load', (e) => {
        const doc = (e as CustomEvent<{ doc: Document }>).detail.doc
        doc.addEventListener('click', (ev) => {
          if (doc.getSelection()?.toString()) return
          if ((ev.target as Element).closest?.('a')) return
          // The frame is wider than the screen (pages are columns), so measure against the reader itself.
          const frame = (doc.defaultView?.frameElement as Element | null)?.getBoundingClientRect()
          const box = host.current?.getBoundingClientRect()
          if (!frame || !box) return
          const x = (frame.left + ev.clientX - box.left) / box.width
          if (x < 0.3) v.goLeft(); else if (x > 0.7) v.goRight(); else toggle.current()
        })
        doc.addEventListener('keydown', (ev) => keyNav(ev, v))
      })
      await v.init({ lastLocation: initial?.locator, showTextStart: !initial })
    })().catch(() => { if (alive) onError('The file may be damaged or protected. Try importing it again.') })
    return () => { alive = false; view.current?.close(); view.current?.remove(); view.current = undefined }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Live style changes.
  useEffect(() => { view.current?.renderer?.setStyles?.(bookCss(s)) }, [s.theme, s.font, s.fontSize]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (view.current && !document.querySelector('[role="dialog"]')) keyNav(e, view.current) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => {
    setChromeExtras({
      tone: theme.tone,
      right: <button className="keycap icon aa" data-testid="reading-settings-button" aria-label="Reading settings" onClick={() => setSheetOpen(true)}>Aa</button>,
      bottom: <input className="scrubber" data-testid="novel-scrubber" type="range" min={0} max={1} step={0.001} value={fraction} aria-label="Position in book"
        onChange={(e) => { const f = Number(e.target.value); setFraction(f); void view.current?.goToFraction(f) }} />,
    })
  }, [theme.tone, fraction, setChromeExtras])

  return (
    <div className={`novel ${theme.tone}`} data-testid="novel" data-cfi={cfi} data-layout={layout} style={{ background: theme.bg, color: theme.fg }}>
      <div className="novel-host" ref={host} />
      <ReadingSettings open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

function keyNav(e: KeyboardEvent, v: FoliateView) {
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') v.goLeft()
  else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') v.goRight()
  else return
  e.preventDefault()
}
