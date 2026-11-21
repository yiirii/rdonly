import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

export const ACCEPT = '.epub,.pdf,.cbz,.cbr,.cb7,application/epub+zip,application/pdf,application/vnd.comicbook+zip,application/vnd.comicbook-rar,application/x-cb7,application/zip,application/x-rar-compressed,application/x-7z-compressed'

/** Folder picking isn't available on iPhone/iPad (iPadOS reports a Mac user agent, so check for touch too). */
export const canPickFolders = () => typeof navigator !== 'undefined'
  && !/iPhone|iPad|iPod/.test(navigator.userAgent) && !(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  && 'webkitdirectory' in document.createElement('input')

export function ImportButton({ onFiles, onFolder, busy, label = 'Import' }: {
  onFiles: (f: File[]) => void; onFolder?: (f: File[]) => void; busy: boolean; label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)
  const withMenu = !!onFolder && canPickFolders()
  const take = (cb: (f: File[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) cb(fs)
  }
  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setMenu(false) } }
    window.addEventListener('pointerdown', away); window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc, true) }
  }, [menu])
  const pick = (r: React.RefObject<HTMLInputElement>) => { setMenu(false); r.current?.click() }
  return (
    <div className="import" ref={root}>
      <button className="keycap primary" data-testid="import-button" disabled={busy} aria-haspopup={withMenu ? 'menu' : undefined} aria-expanded={withMenu ? menu : undefined}
        onClick={() => (withMenu ? setMenu((m) => !m) : input.current?.click())}>
        {busy ? 'Importing…' : label}
      </button>
      <AnimatePresence>
        {menu && (
          <motion.div role="menu" className="menu card import-menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}>
            <button role="menuitem" className="menu-item two-line" onClick={() => pick(input)}>
              <strong>Books…</strong><span className="dim">EPUB, PDF, CBZ, CBR or CB7 files</span>
            </button>
            <button role="menuitem" className="menu-item two-line" onClick={() => pick(folder)}>
              <strong>Folder of images…</strong><span className="dim">Every picture in the folder becomes one comic</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <input ref={input} data-testid="import-input" type="file" multiple accept={ACCEPT} hidden onChange={take(onFiles)} />
      {onFolder && <input ref={folder} data-testid="import-folder-input" type="file" hidden onChange={take(onFolder)} {...{ webkitdirectory: '', directory: '' }} />}
    </div>
  )
}
