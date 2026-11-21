import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { requestPersistence } from '../storage/persist'
import { bridge } from '../storage/types'
import { summarize, useLibrary } from '../state/library'
import { BookCard } from './BookCard'
import { BookActions } from './BookActions'
import type { BookRecord } from '../library/types'
import { DropZone } from './DropZone'
import { ImportButton } from './ImportButton'
import { SettingsSheet } from './SettingsSheet'
import { Toast } from './Toast'
import { settle } from './motion'

export function LibraryScreen() {
  const { books, loaded, busy, sort, load, importFiles, importFolder, setSort } = useLibrary(useShallow((s) => ({
    books: s.books, loaded: s.loaded, busy: s.busy, sort: s.sort, load: s.load, importFiles: s.import, importFolder: s.importFolder, setSort: s.setSort,
  })))
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'warn' } | null>(null)
  const [settings, setSettings] = useState(false)
  const [actionsFor, setActionsFor] = useState<BookRecord | null>(null)
  const closeActions = useCallback(() => setActionsFor(null), [])
  const reduce = useReducedMotion()
  useEffect(() => { void load() }, [load])

  const onFiles = useCallback(async (files: File[]) => {
    if (!bridge()) void requestPersistence()
    const res = await importFiles(files)
    const bad = res.some((r) => r.status === 'error' || r.status === 'unsupported')
    setToast({ msg: summarize(res), tone: bad ? 'warn' : 'ok' })
  }, [importFiles])
  const onFolder = useCallback(async (files: File[]) => {
    const res = await importFolder(files)
    const bad = res.some((r) => r.status === 'error' || r.status === 'unsupported')
    setToast({ msg: summarize(res) || 'No images in that folder.', tone: bad ? 'warn' : 'ok' })
  }, [importFolder])
  const clearToast = useCallback(() => setToast(null), [])
  const closeSettings = useCallback(() => setSettings(false), [])

  return (
    <>
      <header className="topbar">
        <h1>Library</h1>
        {books.length > 1 && (
          <button className="keycap ghost" onClick={() => setSort(sort === 'recent' ? 'title' : 'recent')} aria-label="Change sort order">
            {sort === 'recent' ? 'Recent' : 'A–Z'}
          </button>
        )}
        <button className="keycap icon" data-testid="settings-button" aria-label="Settings" onClick={() => setSettings(true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="3" y="5" width="18" height="2.5" rx="1.25" fill="currentColor" /><rect x="3" y="11" width="18" height="2.5" rx="1.25" fill="currentColor" />
            <rect x="3" y="17" width="18" height="2.5" rx="1.25" fill="currentColor" />
            <rect x="14" y="3.5" width="4" height="5.5" rx="1.5" fill="currentColor" /><rect x="6" y="9.5" width="4" height="5.5" rx="1.5" fill="currentColor" />
            <rect x="12" y="15.5" width="4" height="5.5" rx="1.5" fill="currentColor" />
          </svg>
        </button>
        {books.length > 0 && <ImportButton onFiles={onFiles} onFolder={onFolder} busy={busy} />}
      </header>

      {loaded && books.length === 0 && (
        <motion.div className="empty" data-testid="empty-state" initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={settle}>
          <svg className="empty-art" viewBox="0 0 220 140" aria-hidden="true">
            <rect x="0" y="122" width="220" height="10" rx="3" fill="#25282d" />
            <rect x="0" y="132" width="220" height="5" rx="2" fill="#0b0c0e" />
            <rect x="40" y="52" width="30" height="70" rx="3" fill="#c8a96a" /><rect x="40" y="52" width="30" height="2" fill="#fff" opacity=".25" />
            <rect x="74" y="36" width="24" height="86" rx="3" fill="#7aa2f7" /><rect x="74" y="36" width="24" height="2" fill="#fff" opacity=".25" />
            <rect x="102" y="60" width="34" height="62" rx="3" fill="#e06c75" /><rect x="102" y="60" width="34" height="2" fill="#fff" opacity=".25" />
            <rect x="148" y="44" width="26" height="78" rx="3" fill="#56b6c2" transform="rotate(12 161 122)" />
          </svg>
          <h2>Your shelf is empty</h2>
          <p>Add EPUB, PDF, CBZ, CBR or CB7 files. {bridge() ? 'You can also drop them anywhere in this window.' : 'On iPhone, save files to Files first, then pick them here.'}</p>
          <ImportButton onFiles={onFiles} onFolder={onFolder} busy={busy} label="Import books" />
        </motion.div>
      )}

      {books.length > 0 && (
        <section className="shelf" aria-label="Books">
          <AnimatePresence initial={false}>{books.map((b, i) => <BookCard key={b.id} book={b} index={i} onActions={(b) => { setToast(null); setActionsFor(b) }} />)}</AnimatePresence>
        </section>
      )}

      <DropZone onFiles={onFiles} />
      <Toast message={toast?.msg ?? null} tone={toast?.tone ?? 'ok'} onDone={clearToast} />
      <SettingsSheet open={settings} onClose={closeSettings} />
      <BookActions book={actionsFor} onClose={closeActions} />
    </>
  )
}
