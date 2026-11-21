import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { getFileStore } from '../storage/files'
import { persistStatus, type PersistState } from '../storage/persist'
import { bridge } from '../storage/types'
import { sheet } from './motion'

const mb = (b: number) => (b < 1e6 ? `${Math.max(0.1, b / 1e6).toFixed(1)} MB` : b < 1e9 ? `${(b / 1e6).toFixed(0)} MB` : `${(b / 1e9).toFixed(2)} GB`)

const PERSIST_COPY: Record<PersistState | 'desktop', { text: string; ok: boolean }> = {
  desktop: { text: 'Books are saved on this computer.', ok: true },
  granted: { text: 'This device will keep your books, even when space runs low.', ok: true },
  denied: { text: 'This device may clear your books when space runs low. Add the app to your Home Screen to keep them safe.', ok: false },
  unsupported: { text: 'This browser can’t promise to keep your books. Add the app to your Home Screen to keep them safe.', ok: false },
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReducedMotion()
  const [usage, setUsage] = useState<number | null>(null)
  const [persist, setPersist] = useState<PersistState | 'desktop' | null>(null)
  useEffect(() => {
    if (!open) return
    void getFileStore().usage().then((u) => setUsage(u.usedBytes))
    if (bridge()) setPersist('desktop'); else void persistStatus().then(setPersist)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])
  const p = persist ? PERSIST_COPY[persist] : null
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section
            role="dialog" aria-modal="true" aria-labelledby="settings-title" className="sheet card"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={sheet}
          >
            <div className="sheet-grip" aria-hidden="true" />
            <header className="sheet-head">
              <h2 id="settings-title">Settings</h2>
              <button className="keycap" onClick={onClose}>Done</button>
            </header>
            <h3 className="group-title">Storage</h3>
            <div className="group card">
              <div className="row"><span>Books on this device</span><span className="dim">{usage === null ? '…' : mb(usage)}</span></div>
              <div className="row persist" data-testid="storage-persist-status">
                <span className={`bead ${p?.ok ? 'on' : 'warn'}`} aria-hidden="true" />
                <span>{p?.text ?? 'Checking…'}</span>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
