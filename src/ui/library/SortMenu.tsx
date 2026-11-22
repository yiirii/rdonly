import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { SortKey } from '../../library/query'

const LABELS: Record<SortKey, string> = { added: 'Recently added', read: 'Recently read', title: 'Title A–Z' }
export function SortMenu({ sort, onSort }: { sort: SortKey; onSort(s: SortKey): void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false) } }
    window.addEventListener('pointerdown', away); window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc, true) }
  }, [open])
  return (
    <div className="sort" ref={root}>
      <button type="button" className="sort-button" data-testid="sort-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {LABELS[sort]}
        <motion.svg viewBox="0 0 10 6" width="10" height="6" animate={{ rotate: open ? 180 : 0 }} aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" className="menu card sort-menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}>
            {(Object.keys(LABELS) as SortKey[]).map((k) => (
              <button key={k} role="menuitemradio" aria-checked={sort === k} className={`menu-item ${sort === k ? 'on' : ''}`} onClick={() => { onSort(k); setOpen(false) }}>
                <span className="bead" aria-hidden="true" />{LABELS[k]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
