import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import type { BookRecord } from '../library/types'
import { closeReader } from '../state/route'
import { createProgressSaver, loadProgress, type ProgressRecord } from '../state/progress'
import { getRecordStore } from '../storage/select'
import { getFileStore } from '../storage/files'
import { ImportButton } from '../ui/ImportButton'
import { PlaceholderCover } from '../ui/PlaceholderCover'
import { libraryStore } from '../state/library'
import { summarize } from '../state/library'
import { modeFor, type ReaderModeName } from './modes'
import { takeOpenOrigin } from './openOrigin'
import { ReaderChrome } from './ReaderChrome'
import { ModeMenu } from './ModeMenu'
import { COMIC_FORMATS } from '../core/formats'
import type { ChromeControl, ReaderModeProps } from './types'

type Load = { state: 'loading' } | { state: 'gone' } | { state: 'missing'; book: BookRecord }
  | { state: 'ready'; book: BookRecord; file: Blob; initial?: ProgressRecord }

/** Mode components register here as their tasks land; until then a plain page explains what's coming. */
export const MODE_COMPONENTS: Partial<Record<ReaderModeName, ComponentType<ReaderModeProps>>> = {}

function useChrome(): ChromeControl {
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const arm = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 3000)
  }, [])
  useEffect(() => { arm(); return () => clearTimeout(timer.current) }, [arm])
  return useMemo(() => ({
    visible,
    toggle: () => setVisible((v) => { if (!v) arm(); return !v }),
    hide: () => setVisible(false),
    poke: () => { if (visible) arm() },
  }), [visible, arm])
}

export function ReaderScreen({ bookId }: { bookId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [origin] = useState(takeOpenOrigin)
  const reduce = useReducedMotion()
  const chrome = useChrome()
  const records = getRecordStore()
  const saver = useMemo(() => createProgressSaver(records, bookId), [records, bookId])
  const [label, setLabel] = useState('')
  const [extras, setChromeExtras] = useState<{ right?: React.ReactNode; bottom?: React.ReactNode; tone?: 'light' | 'dark' }>({})

  useEffect(() => {
    let alive = true
    void (async () => {
      const book = await records.get<BookRecord>('books', bookId)
      if (!alive) return
      if (!book || book.deleted) { setLoad({ state: 'gone' }); return }
      const [file, initial] = await Promise.all([getFileStore().getBlob(bookId), loadProgress(records, bookId)])
      if (!alive) return
      setLoad(file ? { state: 'ready', book, file, initial: initial?.deleted ? undefined : initial } : { state: 'missing', book })
    })()
    return () => { alive = false }
  }, [bookId, records])

  // Save on the way out, however the reader is left.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') void saver.flush() }
    const leave = () => void saver.flush()
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', leave)
    window.addEventListener('beforeunload', leave)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('beforeunload', leave)
      void saver.flush()
    }
  }, [saver])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) closeReader() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const book = load.state === 'ready' || load.state === 'missing' ? load.book : undefined
  const mode = book ? modeFor(book) : 'novel'
  const onProgress = useCallback((p: { locator: string; percent: number; label?: string }) => {
    saver.update({ locator: p.locator, percent: p.percent, mode })
    setLabel(p.label ?? `${Math.round(p.percent * 100)}%`)
  }, [saver, mode])

  // Grow out of the tapped cover.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844
  const target = { w: Math.min(240, vw * 0.55), h: Math.min(360, vw * 0.55 * 1.5) }
  const from = origin && !reduce
    ? { x: origin.left + origin.width / 2 - vw / 2, y: origin.top + origin.height / 2 - vh / 2, scale: origin.width / target.w }
    : { x: 0, y: 0, scale: 0.92 }

  const Mode = MODE_COMPONENTS[mode]
  const known = book ?? libraryStore().getState().all.find((b) => b.id === bookId)
  const [coverOut, setCoverOut] = useState(false)
  useEffect(() => {
    if (load.state === 'loading') return
    const t = setTimeout(() => setCoverOut(true), origin && !reduce ? 380 : 0)
    return () => clearTimeout(t)
  }, [load.state, origin, reduce])

  return (
    <motion.div className="reader" data-testid="reader" data-mode={mode}
      initial={{ opacity: origin && !reduce ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <motion.div className="reader-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} />

      {load.state === 'ready' && Mode && (
        <motion.div className="reader-stage" initial={{ opacity: 0 }} animate={{ opacity: coverOut ? 1 : 0 }} transition={{ duration: 0.22 }}>
          <Mode key={mode} book={load.book} file={load.file} initial={load.initial} onProgress={onProgress} chrome={chrome} setChromeExtras={setChromeExtras} />
        </motion.div>
      )}
      {load.state === 'ready' && !Mode && coverOut && (
        <div className="reader-note"><p>This reading mode arrives later in v0.2.</p></div>
      )}
      {load.state === 'missing' && coverOut && <MissingFile book={load.book} />}
      {load.state === 'gone' && (
        <div className="reader-note" data-testid="reader-missing">
          <h2>This book was deleted</h2>
          <button className="keycap" onClick={closeReader}>Back to library</button>
        </div>
      )}

      <AnimatePresence>
        {!coverOut && known && (
          <motion.div key="cover" className="reader-cover" style={{ width: target.w, height: target.h }}
            initial={{ ...from }} animate={{ x: 0, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            {known.coverThumb ? <img src={known.coverThumb} alt="" /> : <PlaceholderCover title={known.title} tag={known.tag} />}
          </motion.div>
        )}
      </AnimatePresence>

      <ReaderChrome visible={chrome.visible || load.state !== 'ready'} title={known?.title ?? ''} onBack={closeReader} tone={extras.tone ?? 'dark'} onInteract={chrome.poke}
        right={<>{load.state === 'ready' && COMIC_FORMATS.includes(load.book.format) && (
          <ModeMenu mode={mode} onChange={async (m) => {
            const b = await libraryStore().getState().update(load.book.id, { modeOverride: m })
            await saver.flush()
            const initial = await loadProgress(records, bookId)
            setLoad({ ...load, book: b, initial: initial ?? undefined })
          }} />
        )}{extras.right}</>}
        bottom={load.state === 'ready' ? <>{extras.bottom}<span className="reader-progress" data-testid="reader-progress">{label}</span></> : undefined} />
    </motion.div>
  )
}

function MissingFile({ book }: { book: BookRecord }) {
  const [msg, setMsg] = useState<string | null>(null)
  const onFiles = async (files: File[]) => {
    const res = await libraryStore().getState().import(files)
    if (res.some((r) => r.bookId === book.id && (r.status === 'relinked' || r.status === 'added'))) location.reload()
    else setMsg(`That file isn’t this book. ${summarize(res)}`)
  }
  return (
    <div className="reader-note missing" data-testid="reader-missing">
      <h2>File missing on this device</h2>
      <p>Your place and details for <em>{book.title}</em> are safe. Import the same file again to read it.</p>
      <ImportButton onFiles={onFiles} busy={false} label="Import file" />
      {msg && <p className="dim">{msg}</p>}
    </div>
  )
}
