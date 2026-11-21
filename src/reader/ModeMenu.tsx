import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { MODE_LABELS, type ReaderModeName } from './modes'

const COMIC_MODES: ReaderModeName[] = ['paged-rtl', 'paged-ltr', 'webtoon']

/** Lets a comic be read as manga, comic or webtoon; the choice sticks to the book. */
export function ModeMenu({ mode, onChange }: { mode: ReaderModeName; onChange(m: ReaderModeName): void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [open])
  return (
    <div className="mode-menu" ref={root}>
      <button className="keycap icon" data-testid="reader-mode-button" aria-label="Reading mode" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="3" y="4" width="8" height="16" rx="2" fill="currentColor" /><rect x="13" y="4" width="8" height="16" rx="2" fill="currentColor" opacity=".55" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" className="menu card" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}>
            {COMIC_MODES.map((m) => (
              <button key={m} role="menuitemradio" aria-checked={mode === m} className={`menu-item ${mode === m ? 'on' : ''}`}
                onClick={() => { setOpen(false); if (m !== mode) onChange(m) }}>
                <span className="bead" aria-hidden="true" />{MODE_LABELS[m]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
