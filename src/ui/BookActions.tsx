import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { BookTag } from '../core/tags'
import type { BookRecord } from '../library/types'
import { libraryStore, useLibrary } from '../state/library'
import { bookStatus } from '../library/query'
import { sheet, TAG_COLOURS, TAG_LABELS } from './motion'

type View = 'menu' | 'edit' | 'type' | 'confirm' | 'collections'
const TAGS: BookTag[] = ['novel', 'manga', 'webtoon', 'comic', 'document']

export function BookActions({ book, onClose, onSelect }: { book: BookRecord | null; onClose(): void; onSelect?(b: BookRecord): void }) {
  const reduce = useReducedMotion()
  const [view, setView] = useState<View>('menu')
  useEffect(() => { if (book) setView('menu') }, [book])
  useEffect(() => {
    if (!book) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [book, onClose])
  const lib = libraryStore().getState()

  return (
    <AnimatePresence>
      {book && (
        <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1, pointerEvents: 'auto' }} exit={{ opacity: 0, pointerEvents: 'none' }}>
          <motion.section role="dialog" aria-modal="true" aria-label={book.title} className="sheet card actions-sheet" data-testid="book-actions"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }} transition={sheet}>
            <div className="sheet-grip" aria-hidden="true" />
            <header className="actions-head">
              <div className="actions-cover">{book.coverThumb ? <img src={book.coverThumb} alt="" /> : <span style={{ background: TAG_COLOURS[book.tag] }} />}</div>
              <div><h2>{book.title}</h2>{book.author && <p className="dim">{book.author}</p>}</div>
            </header>

            {view === 'menu' && (
              <div className="action-list">
                <button className="action" onClick={() => setView('edit')}>Edit details</button>
                <button className="action" onClick={() => setView('collections')}>Add to collection…</button>
                <FinishedToggle book={book} onDone={onClose} />
                <button className="action" onClick={() => setView('type')}>Change type<span className="dim">{TAG_LABELS[book.tag]}</span></button>
                {onSelect && <button className="action" onClick={() => onSelect(book)}>Select<span className="dim">pick several books</span></button>}
                <button className="action danger" onClick={() => setView('confirm')}>Delete</button>
              </div>
            )}

            {view === 'collections' && <CollectionPicker book={book} />}

            {view === 'edit' && <EditForm book={book} onDone={onClose} onCancel={() => setView('menu')} />}

            {view === 'type' && (
              <div className="action-list" role="radiogroup" aria-label="Type">
                {TAGS.map((t) => (
                  <button key={t} role="radio" aria-checked={book.tag === t} className={`action ${book.tag === t ? 'on' : ''}`}
                    onClick={async () => { await lib.update(book.id, { tag: t }); onClose() }}>
                    <span className="tag-dot big" style={{ background: TAG_COLOURS[t] }} aria-hidden="true" />{TAG_LABELS[t]}
                  </button>
                ))}
              </div>
            )}

            {view === 'confirm' && (
              <div className="confirm">
                <h3>Delete {book.title}?</h3>
                <p className="dim">This removes the book and your place in it.</p>
                <div className="confirm-row">
                  <button className="keycap" onClick={() => setView('menu')}>Cancel</button>
                  <button className="keycap danger" onClick={async () => { await lib.remove(book.id); onClose() }}>Delete book</button>
                </div>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function FinishedToggle({ book, onDone }: { book: BookRecord; onDone(): void }) {
  const progress = useLibrary((s) => s.progress.find((p) => p.id === book.id))
  const finished = bookStatus(book, progress) === 'finished'
  return (
    <button className="action" onClick={async () => {
      // Back to automatic if the manual mark now matches what progress says anyway.
      const want = !finished
      const auto = bookStatus({ finished: undefined }, progress) === 'finished'
      await libraryStore().getState().update(book.id, { finished: want === auto ? undefined : want })
      onDone()
    }}>{finished ? 'Mark as not finished' : 'Mark as finished'}</button>
  )
}

function CollectionPicker({ book }: { book: BookRecord }) {
  const collections = useLibrary((s) => s.collections)
  const items = useLibrary((s) => s.items)
  const [name, setName] = useState('')
  const [local, setLocal] = useState<Record<string, boolean>>({}) // ticks show at once; the save follows
  const lib = libraryStore().getState()
  return (
    <div className="picker">
      {collections.length === 0 && <p className="dim">No collections yet. Make one below.</p>}
      {collections.map((c) => {
        const on = local[c.id] ?? items.some((i) => !i.deleted && i.collectionId === c.id && i.bookId === book.id)
        return (
          <label key={c.id} className="action check">
            <input type="checkbox" checked={on} aria-label={c.name}
              onChange={(e) => { const v = e.target.checked; setLocal((l) => ({ ...l, [c.id]: v })); void lib.setMembership(c.id, book.id, v) }} />
            <span className="tab-dot" style={{ background: c.color }} aria-hidden="true" />{c.name}
          </label>
        )
      })}
      <form className="picker-new" onSubmit={async (e) => {
        e.preventDefault(); if (!name.trim()) return
        const c = await lib.newCollection(name); await lib.setMembership(c.id, book.id, true); setName('')
      }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New collection…" aria-label="New collection name" />
        <button className="keycap" type="submit">Add</button>
      </form>
    </div>
  )
}

function EditForm({ book, onDone, onCancel }: { book: BookRecord; onDone(): void; onCancel(): void }) {
  const [f, setF] = useState({ title: book.title, author: book.author ?? '', series: book.series ?? '', volume: book.volume?.toString() ?? '', tags: (book.tags ?? []).join(', ') })
  const [err, setErr] = useState<string | null>(null)
  const field = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field"><span>{label}</span><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>
  )
  return (
    <form className="edit-form" onSubmit={async (e) => {
      e.preventDefault()
      try {
        await libraryStore().getState().update(book.id, { title: f.title, author: f.author, series: f.series, volume: f.volume ? Number(f.volume) : undefined, tags: f.tags.split(',') })
        onDone()
      } catch (x) { setErr((x as Error).message) }
    }}>
      {field('title', 'Title', { required: true, autoFocus: true })}
      {field('author', 'Author')}
      <div className="field-row">{field('series', 'Series')}{field('volume', 'Volume', { inputMode: 'decimal', pattern: '[0-9.]*' })}</div>
      {field('tags', 'Tags', { placeholder: 'e.g. fantasy, cosy, re-read' })}
      {err && <p className="error">{err}</p>}
      <div className="confirm-row">
        <button type="button" className="keycap" onClick={onCancel}>Cancel</button>
        <button type="submit" className="keycap primary">Save</button>
      </div>
    </form>
  )
}
