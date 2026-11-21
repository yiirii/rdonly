import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { settle } from '../ui/motion'

export function ReaderChrome({ visible, title, onBack, right, bottom, tone, onInteract, onHold }: {
  visible: boolean; title: string; onBack(): void; right?: ReactNode; bottom?: ReactNode; tone: 'dark' | 'light'; onInteract?(): void; onHold?(on: boolean): void
}) {
  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.header key="top" onPointerDown={onInteract} onInput={onInteract} onPointerEnter={() => onHold?.(true)} onPointerLeave={() => onHold?.(false)} className={`reader-bar top ${tone}`} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={settle}>
            <button className="keycap icon" data-testid="reader-back" aria-label="Back to library" onClick={onBack}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <h1 data-testid="reader-title">{title}</h1>
            <div className="reader-bar-right">{right}</div>
          </motion.header>
          {bottom && (
            <motion.footer key="bottom" onPointerDown={onInteract} onInput={onInteract} onPointerEnter={() => onHold?.(true)} onPointerLeave={() => onHold?.(false)} className={`reader-bar bottom ${tone}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={settle}>
              {bottom}
            </motion.footer>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
