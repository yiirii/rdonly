import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { settingsStore, useSettings, type Settings } from '../../state/settings'
import { sheet } from '../../ui/motion'
import { FONTS } from './fontList'
import { READING_THEMES, themeById } from './themes'

function Segmented<K extends keyof Settings>({ label, k, options }: { label: string; k: K; options: [Settings[K], string][] }) {
  const value = useSettings((s) => s[k])
  return (
    <div className="seg-row">
      <span className="seg-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, name]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => settingsStore.getState().set(k, v)}>{name}</button>
        ))}
      </div>
    </div>
  )
}

const useWide = () => {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 900px)').matches)
  useEffect(() => { const m = matchMedia('(min-width: 900px)'); const h = () => setWide(m.matches); m.addEventListener('change', h); return () => m.removeEventListener('change', h) }, [])
  return wide
}

export function ReadingSettings({ open, onClose }: { open: boolean; onClose(): void }) {
  const reduce = useReducedMotion()
  const s = useSettings((x) => x)
  const set = settingsStore.getState().set
  const wide = useWide()
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim light" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section role="dialog" aria-modal="true" aria-label="Reading settings" className="sheet card reading-sheet"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }} transition={sheet}>
            <div className="sheet-grip" aria-hidden="true" />

            <div className="sheet-row-head"><span className="seg-label">Page</span><span className="dim">{themeById(s.theme).name}</span></div>
            <div className="swatches" role="radiogroup" aria-label="Page colour">
              {READING_THEMES.map((t) => (
                <button key={t.id} role="radio" aria-checked={s.theme === t.id} aria-label={t.name} title={t.name} data-testid={`theme-${t.id}`}
                  className={`swatch ${s.theme === t.id ? 'on' : ''}`} style={{ background: t.bg, color: t.fg }} onClick={() => set('theme', t.id)}>
                  <span className="swatch-aa">Aa</span>
                </button>
              ))}
            </div>

            <div className="fonts" role="radiogroup" aria-label="Font">
              {FONTS.map((f) => (
                <button key={f.id} role="radio" aria-checked={s.font === f.id} data-testid={`font-${f.id}`} className={`font-chip ${s.font === f.id ? 'on' : ''}`}
                  style={{ fontFamily: f.family || 'inherit' }} onClick={() => set('font', f.id)}>{f.name}</button>
              ))}
            </div>

            <div className="size-row">
              <button className="keycap" data-testid="font-size-down" aria-label="Smaller text" onClick={() => set('fontSize', Math.max(70, s.fontSize - 10))}><span style={{ fontSize: 13 }}>A</span></button>
              <div className="size-track" aria-hidden="true"><div className="size-fill" style={{ transform: `scaleX(${(s.fontSize - 70) / 110})` }} /></div>
              <button className="keycap" data-testid="font-size-up" aria-label="Larger text" onClick={() => set('fontSize', Math.min(180, s.fontSize + 10))}><span style={{ fontSize: 19 }}>A</span></button>
            </div>

            <Segmented label="Spacing" k="lineHeight" options={[[1.4, 'Compact'], [1.6, 'Normal'], [1.8, 'Airy']]} />
            <Segmented label="Margins" k="margins" options={[['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']]} />
            <Segmented label="Page turn" k="pageTurn" options={[['glide', 'Glide'], ['fold', 'Fold'], ['scroll', 'Scroll']]} />

            {wide && (
              <div className="seg-row">
                <span className="seg-label">Two pages side by side</span>
                <button role="switch" aria-label="Two pages side by side" aria-checked={s.columns} data-testid="columns-switch" className={`bead-switch ${s.columns ? 'on' : ''}`} onClick={() => set('columns', !s.columns)}>
                  <span className="bead" />
                </button>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
