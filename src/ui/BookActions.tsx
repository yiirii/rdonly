import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { BookTag } from '../core/tags'
import type { BookRecord } from '../library/types'
import { libraryStore } from '../state/library'
import { sheet, TAG_COLOURS, TAG_LABELS } from './motion'

type View = 'menu' | 'edit' | 'type' | 'confirm'
const TAGS: BookTag[] = ['novel', 'manga', 'webtoon', 'comic', 'document']

export function BookActions({ book, onClose }: { book: BookRecord | null; onClose(): void }) {
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
        <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                <button className="action" onClick={() => setView('type')}>Change type<span className="dim">{TAG_LABELS[book.tag]}</span></button>
                <button className="action danger" onClick={() => setView('confirm')}>Delete</button>
              </div>
            )}

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

function EditForm({ book, onDone, onCancel }: { book: BookRecord; onDone(): void; onCancel(): void }) {
  const [f, setF] = useState({ title: book.title, author: book.author ?? '', series: book.series ?? '', volume: book.volume?.toString() ?? '' })
  const [err, setErr] = useState<string | null>(null)
  const field = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field"><span>{label}</span><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>
  )
  return (
    <form className="edit-form" onSubmit={async (e) => {
      e.preventDefault()
      try {
        await libraryStore().getState().update(book.id, { title: f.title, author: f.author, series: f.series, volume: f.volume ? Number(f.volume) : undefined })
        onDone()
      } catch (x) { setErr((x as Error).message) }
    }}>
      {field('title', 'Title', { required: true, autoFocus: true })}
      {field('author', 'Author')}
      <div className="field-row">{field('series', 'Series')}{field('volume', 'Volume', { inputMode: 'decimal', pattern: '[0-9.]*' })}</div>
      {err && <p className="error">{err}</p>}
      <div className="confirm-row">
        <button type="button" className="keycap" onClick={onCancel}>Cancel</button>
        <button type="submit" className="keycap primary">Save</button>
      </div>
    </form>
  )
}
