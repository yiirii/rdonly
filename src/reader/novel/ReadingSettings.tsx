import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect } from 'react'
import { settingsStore, useSettings } from '../../state/settings'
import { sheet } from '../../ui/motion'
import { FONTS } from './fonts'
import { READING_THEMES } from './themes'

export function ReadingSettings({ open, onClose }: { open: boolean; onClose(): void }) {
  const reduce = useReducedMotion()
  const s = useSettings((x) => x)
  const set = settingsStore.getState().set
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
            <div className="swatches" role="radiogroup" aria-label="Page colour">
              {READING_THEMES.map((t) => (
                <button key={t.id} role="radio" aria-checked={s.theme === t.id} data-testid={`theme-${t.id}`} className={`swatch ${s.theme === t.id ? 'on' : ''}`}
                  style={{ background: t.bg, color: t.fg }} onClick={() => set('theme', t.id)}>
                  <span className="swatch-aa">Aa</span><span className="swatch-name">{t.name}</span>
                </button>
              ))}
            </div>
            <div className="size-row">
              <button className="keycap" data-testid="font-size-down" aria-label="Smaller text" onClick={() => set('fontSize', Math.max(70, s.fontSize - 10))}><span style={{ fontSize: 13 }}>A</span></button>
              <div className="size-track" aria-hidden="true"><div className="size-fill" style={{ transform: `scaleX(${(s.fontSize - 70) / 110})` }} /></div>
              <button className="keycap" data-testid="font-size-up" aria-label="Larger text" onClick={() => set('fontSize', Math.min(180, s.fontSize + 10))}><span style={{ fontSize: 19 }}>A</span></button>
            </div>
            <div className="fonts" role="radiogroup" aria-label="Font">
              {FONTS.map((f) => (
                <button key={f.id} role="radio" aria-checked={s.font === f.id} data-testid={`font-${f.id}`} className={`font-chip ${s.font === f.id ? 'on' : ''}`}
                  style={{ fontFamily: f.family || 'inherit' }} onClick={() => set('font', f.id)}>{f.name}</button>
              ))}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
