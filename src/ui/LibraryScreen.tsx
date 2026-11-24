import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { queryLibrary, type CollectionRecord } from '../library/query'
import type { BookRecord } from '../library/types'
import { requestPersistence } from '../storage/persist'
import { bridge } from '../storage/types'
import { libraryStore, summarize, useLibrary } from '../state/library'
import { closeSeries, useRoute } from '../state/route'
import { settingsStore, useSettings } from '../state/settings'
import { BookActions } from './BookActions'
import { BookCard } from './BookCard'
import { DropZone } from './DropZone'
import { ImportButton } from './ImportButton'
import { CollectionSheet } from './library/CollectionSheet'
import { ContinueCard } from './library/ContinueCard'
import { LibraryTabs } from './library/LibraryTabs'
import { SelectionBar } from './library/SelectionBar'
import { SortMenu } from './library/SortMenu'
import { TypeChips } from './library/TypeChips'
import { SeriesCard } from './SeriesCard'
import { SettingsSheet } from './SettingsSheet'
import { Toast } from './Toast'
import { settle } from './motion'

const EMPTY_COPY: Record<string, string> = {
  reading: 'Books you’ve opened but not finished show up here.',
  new: 'Everything here has been opened. Nice.',
  finished: 'Books you reach the end of land here.',
}

export function LibraryScreen() {
  const s = useLibrary(useShallow((x) => ({
    all: x.all, progress: x.progress, collections: x.collections, items: x.items, loaded: x.loaded, busy: x.busy,
    sort: x.sort, tab: x.tab, types: x.types, search: x.search,
  })))
  const lib = libraryStore().getState()
  const savedCover = useSettings((x) => x.coverSize)
  // The slider moves a local value every frame; the setting is saved once you stop dragging.
  const [coverSize, setCoverSize] = useState(savedCover)
  useEffect(() => setCoverSize(savedCover), [savedCover])
  const saveCover = useRef<ReturnType<typeof setTimeout>>()
  const pendingCover = useRef<number | null>(null)
  const flushCover = useCallback(() => { clearTimeout(saveCover.current); if (pendingCover.current !== null) settingsStore.getState().set('coverSize', pendingCover.current); pendingCover.current = null }, [])
  const onCover = (v: number) => { setCoverSize(v); pendingCover.current = v; clearTimeout(saveCover.current); saveCover.current = setTimeout(flushCover, 250) }
  useEffect(() => { addEventListener('pagehide', flushCover); return () => { removeEventListener('pagehide', flushCover); flushCover() } }, [flushCover])
  // Column count: covers re-render (and glide to their new place) only when it changes.
  const shelfRef = useRef<HTMLElement>(null)
  const [cols, setCols] = useState(0)
  useEffect(() => {
    const el = shelfRef.current; if (!el) return
    const measure = () => setCols(getComputedStyle(el).gridTemplateColumns.split(' ').length)
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect()
  })
  const reduce = useReducedMotion()
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'warn' } | null>(null)
  const [settings, setSettings] = useState(false)
  const [actionsFor, setActionsFor] = useState<BookRecord | null>(null)
  const [collectionSheet, setCollectionSheet] = useState<{ open: boolean; editing?: CollectionRecord }>({ open: false })
  const [selected, setSelected] = useState<string[]>([])
  const [selecting, setSelecting] = useState(false)
  const anchor = useRef<string | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const route = useRoute()

  // Reload when coming back from the reader so progress, status and the Continue card are fresh.
  useEffect(() => { void lib.load(); if (!settingsStore.getState().loaded) void settingsStore.getState().load() }, [route.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => queryLibrary(
    { books: s.all, progress: s.progress, collections: s.collections, items: s.items },
    { tab: s.tab, types: s.types, search: s.search, sort: s.sort },
  ), [s.all, s.progress, s.collections, s.items, s.tab, s.types, s.search, s.sort])
  const progressOf = useMemo(() => new Map(s.progress.filter((p) => !p.deleted).map((p) => [p.id, p.percent])), [s.progress])

  const seriesKeyOpen = route.name === 'series' ? route.key : route.name === 'reader' ? route.series : undefined
  // The open folder honours the current search/chips/tab; fall back to the whole series if none of it matches.
  const folderFiltered = useMemo(() => seriesKeyOpen ? view.items.find((i) => i.kind === 'series' && i.key === seriesKeyOpen) : undefined, [seriesKeyOpen, view.items])
  const folderAll = useMemo(() => !seriesKeyOpen ? undefined : folderFiltered ?? queryLibrary({ books: s.all, progress: s.progress, collections: s.collections, items: s.items }, {}).items.find((i) => i.kind === 'series' && i.key === seriesKeyOpen), [seriesKeyOpen, folderFiltered, s.all, s.progress, s.collections, s.items])
  const folder = folderAll?.kind === 'series' ? folderAll : undefined
  useEffect(() => { if (s.loaded && route.name === 'series' && !folder) closeSeries() }, [s.loaded, route.name, folder])
  useEffect(() => {
    if (route.name !== 'series') return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !selecting && !document.querySelector('[role="dialog"], [role="menu"]')) closeSeries() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [route.name, selecting])

  // "/" focuses search on the laptop.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && route.name !== 'reader' && document.activeElement?.tagName !== 'INPUT' && !document.querySelector('[role="dialog"]')) { e.preventDefault(); search.current?.focus() }
      if (e.key === 'Escape' && selecting) { setSelecting(false); setSelected([]) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [route.name, selecting])

  const onFiles = useCallback(async (files: File[]) => {
    if (!bridge()) void requestPersistence()
    const res = await lib.import(files)
    // Importing while a collection is open puts the new books there too.
    const tab = libraryStore().getState().tab
    if (libraryStore().getState().collections.some((c) => c.id === tab)) {
      const ids = res.filter((r) => r.bookId && (r.status === 'added' || r.status === 'duplicate')).map((r) => r.bookId!)
      if (ids.length) await lib.addToCollection(tab, ids)
    }
    setToast({ msg: summarize(res), tone: res.some((r) => r.status === 'error' || r.status === 'unsupported') ? 'warn' : 'ok' })
  }, [lib])
  const onFolder = useCallback(async (files: File[]) => {
    const res = await lib.importFolder(files)
    setToast({ msg: summarize(res) || 'No images in that folder.', tone: res.some((r) => r.status === 'error' || r.status === 'unsupported') ? 'warn' : 'ok' })
  }, [lib])

  // Selection: tap/click in selection mode, Ctrl-click to add, Shift-click for a range.
  // Only books you can see: volumes tucked inside a folder never join a Shift-range on the shelf.
  const visibleIds = useMemo(() => (folder ? folder.books : view.items.flatMap((i) => (i.kind === 'book' ? [i.book] : []))).map((b) => b.id), [folder, view.items])
  const onSelect = useCallback((b: BookRecord, e: { shift: boolean; meta: boolean }) => {
    setSelecting(true)
    setSelected((cur) => {
      const a = anchor.current ? visibleIds.indexOf(anchor.current) : -1, z = visibleIds.indexOf(b.id)
      if (e.shift && a >= 0 && z >= 0) {
        const range = visibleIds.slice(Math.min(a, z), Math.max(a, z) + 1)
        return [...new Set([...cur, ...range])]
      }
      anchor.current = b.id
      return cur.includes(b.id) ? cur.filter((x) => x !== b.id) : [...cur, b.id]
    })
  }, [visibleIds])
  useEffect(() => { if (selecting && selected.length === 0 && !anchor.current) setSelecting(false) }, [selecting, selected])
  // Stable callbacks + plain values, so a memoised card only re-renders when its own book changes.
  const selectedRef = useRef(selected); selectedRef.current = selected
  const dragIds = useCallback((bk: BookRecord) => (selectedRef.current.includes(bk.id) ? selectedRef.current : [bk.id]), [])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const onActions = useCallback((bk: BookRecord) => { setToast(null); setActionsFor(bk) }, [])
  const endSelection = () => { setSelecting(false); setSelected([]); anchor.current = null }

  const card = (b: BookRecord, i: number) => (
    <BookCard key={b.id} book={b} index={i} progress={progressOf.get(b.id)} finished={view.status.get(b.id) === 'finished'}
      selecting={selecting} selected={selectedSet.has(b.id)} onSelect={onSelect} dragIds={dragIds} onActions={onActions} cols={cols} />
  )
  const liveCount = s.all.filter((b) => !b.deleted).length
  const isEmptyLibrary = s.loaded && liveCount === 0
  const hasBooks = s.loaded && liveCount > 0 // nothing flips in and out while the first load runs

  return (
    <div className="library" style={{ ['--cover' as string]: coverSize }}>
      <header className="topbar">
        <h1>Library{hasBooks && <small className="count">{view.counts.all} {view.counts.all === 1 ? 'book' : 'books'}</small>}</h1>
        <motion.button className="keycap settings-btn" data-testid="settings-button" aria-label="Settings" onClick={() => setSettings(true)}
          whileHover="turn" whileTap="press">
          {/* Only the gear turns, a little, and settles without wobble */}
          <motion.svg variants={reduce ? {} : { turn: { rotate: 30 }, press: { rotate: 45 } }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="10.6" y="1.8" width="2.8" height="4.6" rx="1.1" fill="currentColor" transform={`rotate(${a} 12 12)`} />)}
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
          </motion.svg>
          <span className="settings-label">Settings</span>
        </motion.button>
        {hasBooks && <ImportButton onFiles={onFiles} onFolder={onFolder} busy={s.busy} />}
      </header>

      {isEmptyLibrary && (
        <motion.div className="empty" data-testid="empty-state" initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={settle}>
          <EmptyShapes />
          <h2>Your shelf is empty</h2>
          <p>Add EPUB, PDF, CBZ, CBR or CB7 files. {bridge() ? 'You can also drop them anywhere in this window.' : 'On iPhone, save files to Files first, then pick them here.'}</p>
          <ImportButton onFiles={onFiles} onFolder={onFolder} busy={s.busy} label="Import books" />
        </motion.div>
      )}

      {hasBooks && !folder && (
        <div className={`lib-top ${view.lastRead ? 'has-continue' : ''}`}>
          {view.lastRead && <ContinueCard book={view.lastRead} progress={view.lastReadProgress} />}
          <div className="lib-controls">
            <div className="lib-sticky">
              <label className="search">
                <motion.svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className="lens" whileTap={{}}
                  animate={s.search ? { scale: [1, 1.25, 1], rotate: [0, -12, 0] } : { scale: 1 }} transition={{ duration: 0.35 }}>
                  <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.2" /><rect x="12.5" y="12" width="2.6" height="6" rx="1.3" fill="currentColor" transform="rotate(-45 13.8 15)" />
                </motion.svg>
                <input ref={search} type="search" role="searchbox" aria-label="Search books" placeholder="Search titles, authors, series, tags" value={s.search} onChange={(e) => lib.setSearch(e.target.value)} />
                {!s.search && <kbd className="kbd">/</kbd>}
              </label>
              <LibraryTabs tab={s.tab} counts={view.counts} collections={s.collections} onTab={lib.setTab}
                onNew={() => setCollectionSheet({ open: true })}
                onTabMenu={(c) => setCollectionSheet({ open: true, editing: c })}
                onReorder={(ids) => void lib.reorderCollections(ids)}
                onDropBooks={async (cid, ids) => { await lib.addToCollection(cid, ids); setToast({ msg: `Added ${ids.length} ${ids.length === 1 ? 'book' : 'books'} to ${s.collections.find((c) => c.id === cid)?.name}.`, tone: 'ok' }); endSelection() }} />
            </div>
            <TypeChips types={s.types} onToggle={lib.toggleType} />
            <div className="toolbar">
              <SortMenu sort={s.sort} onSort={lib.setSort} />
              <label className="size">
                <span aria-hidden="true" className="a-small">A</span>
                <input type="range" min={0.75} max={1.4} step={0.01} value={coverSize} aria-label="Cover size"
                  onChange={(e) => onCover(Number(e.target.value))} />
                <span aria-hidden="true" className="a-big">A</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {hasBooks && !folder && (
        view.items.length ? (
          <section className="shelf" aria-label="Books" ref={shelfRef}>
            <AnimatePresence initial={false} mode="popLayout">{view.items.map((it, i) => it.kind === 'book'
              ? card(it.book, i)
              : <SeriesCard key={`s:${it.key}`} seriesKey={it.key} name={it.name} books={it.books} index={i} cols={cols} />)}</AnimatePresence>
          </section>
        ) : s.loaded && (
          <motion.div className="no-results" data-testid="no-results" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={settle}>
            <EmptyShapes small />
            <p>{s.search || s.types.length ? 'Nothing matches. Try fewer filters or another word.' : EMPTY_COPY[s.tab] ?? 'Nothing in this collection yet. Add books from their menu, or drag covers onto the tab.'}</p>
          </motion.div>
        )
      )}

      {folder && (
        <section className="series-view" data-testid="series-screen" aria-label={folder.name}>
          <header className="series-head">
            <button className="keycap icon" data-testid="series-back" aria-label="Back to library" onClick={closeSeries}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div><h2>{folder.name}</h2><p className="dim">{folder.books.length} volumes</p></div>
          </header>
          <div className="shelf"><AnimatePresence initial={false}>{folder.books.map((b, i) => card(b, i))}</AnimatePresence></div>
        </section>
      )}

      <SelectionBar count={selected.length} open={selecting} collections={s.collections} onDone={endSelection}
        onAddTo={async (cid) => { await lib.addToCollection(cid, selected); setToast({ msg: `Added ${selected.length} to ${s.collections.find((c) => c.id === cid)?.name}.`, tone: 'ok' }); endSelection() }}
        onTag={async (tag) => { for (const id of selected) { const b = s.all.find((x) => x.id === id); if (b) await lib.update(id, { tags: [...(b.tags ?? []), tag] }) } endSelection() }}
        onDelete={async () => { await lib.removeMany(selected); endSelection() }} />

      <DropZone onFiles={onFiles} />
      <Toast message={toast?.msg ?? null} tone={toast?.tone ?? 'ok'} onDone={useCallback(() => setToast(null), [])} />
      <SettingsSheet open={settings} onClose={useCallback(() => setSettings(false), [])} />
      <BookActions book={actionsFor} onClose={useCallback(() => setActionsFor(null), [])}
        onSelect={(b) => { setActionsFor(null); anchor.current = b.id; setSelecting(true); setSelected([b.id]) }} />
      <CollectionSheet open={collectionSheet.open} editing={collectionSheet.editing} onClose={useCallback(() => setCollectionSheet({ open: false }), [])}
        onCreated={(c) => setToast({ msg: `Made “${c.name}”. Add books from their menu${bridge() ? ' or drag covers onto the tab' : ''}.`, tone: 'ok' })} />
    </div>
  )
}

/** Flat shapes that wobble gently: the empty-state illustration. */
function EmptyShapes({ small }: { small?: boolean }) {
  const reduce = useReducedMotion()
  const wobble = (d: number, r: number) => reduce ? {} : { animate: { rotate: [0, r, -r, 0], y: [0, -3, 0] }, transition: { duration: 2.6, repeat: Infinity, delay: d, ease: 'easeInOut' as const } }
  return (
    <svg className={`empty-art ${small ? 'small' : ''}`} viewBox="0 0 220 140" aria-hidden="true">
      <rect x="0" y="122" width="220" height="10" rx="3" fill="#25282d" /><rect x="0" y="132" width="220" height="5" rx="2" fill="#0b0c0e" />
      <motion.rect x="40" y="52" width="30" height="70" rx="3" fill="#c8a96a" style={{ originX: '55px', originY: '122px' }} {...wobble(0, 2)} />
      <motion.rect x="74" y="36" width="24" height="86" rx="3" fill="#7aa2f7" style={{ originX: '86px', originY: '122px' }} {...wobble(0.3, -2.5)} />
      <motion.circle cx="119" cy="102" r="20" fill="#e06c75" {...wobble(0.6, 0)} />
      <motion.polygon points="148,122 172,80 196,122" fill="#56b6c2" style={{ originX: '172px', originY: '122px' }} {...wobble(0.9, 3)} />
    </svg>
  )
}
