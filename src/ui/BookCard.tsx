import { motion, useReducedMotion } from 'framer-motion'
import { memo, useRef } from 'react'
import type { BookRecord } from '../library/types'
import { openBook } from '../state/route'
import { setOpenOrigin } from '../reader/openOrigin'
import { PlaceholderCover } from './PlaceholderCover'
import { settle, TAG_COLOURS, TAG_LABELS } from './motion'

export interface SelectProps { selecting?: boolean; selected?: boolean; onSelect?(b: BookRecord, e: { shift: boolean; meta: boolean }): void; dragIds?(b: BookRecord): string[] }
type CardProps = { book: BookRecord; index: number; onActions(b: BookRecord): void; progress?: number; finished?: boolean } & SelectProps

/** Memoised: with 100+ books, typing in search or ticking one card must not re-render every other card. */
export const BookCard = memo(BookCardImpl)

function BookCardImpl({ book, index, onActions, progress, finished, selecting, selected, onSelect, dragIds }: CardProps) {
  const select = onSelect ? { selecting: !!selecting, selected: !!selected, onSelect, dragIds: dragIds ?? ((b: BookRecord) => [b.id]) } : undefined
  const reduce = useReducedMotion()
  // Long-press (phone) or right-click (laptop) opens the book's actions instead of the book.
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean; x: number; y: number } | null>(null)
  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer) }
  return (
    <motion.button
      type="button"
      layout={!reduce}
      className="book"
      data-testid="book-card"
      aria-label={`Open ${book.title}`}
      exit={{ opacity: 0, scale: 0.15, rotate: 12, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        // Long-press opens the book's actions (which include "Select"); in selection mode it just selects.
        const p = { fired: false, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
          p.fired = true; navigator.vibrate?.(10)
          if (select?.selecting) select.onSelect(book, { shift: false, meta: true })
          else onActions(book)
        }, 450) }
        press.current = p
      }}
      onPointerMove={(e) => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress() }}
      onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); cancelPress(); if (!press.current?.fired) onActions(book) }}
      draggable={!!select}
      onDragStart={(e) => {
        if (!select) return
        cancelPress()
        const ids = select.dragIds(book)
        ;(e as unknown as React.DragEvent).dataTransfer.setData('application/x-rdonly-books', JSON.stringify(ids))
        ;(e as unknown as React.DragEvent).dataTransfer.effectAllowed = 'copy'
      }}
      data-selected={select?.selected || undefined}
      aria-pressed={select?.selecting ? select.selected : undefined}
      onClick={(e) => {
        if (press.current?.fired) { press.current = null; return }
        if (select && (select.selecting || e.ctrlKey || e.metaKey || e.shiftKey)) { select.onSelect(book, { shift: e.shiftKey, meta: e.ctrlKey || e.metaKey }); return }
        setOpenOrigin(e.currentTarget.querySelector('.book-cover')!.getBoundingClientRect()); openBook(book.id)
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -18, rotate: index % 2 ? 4 : -4, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ ...settle, delay: Math.min(index, 12) * 0.035 }}
    >
      <div className="book-cover">
        {book.coverThumb ? <img src={book.coverThumb} alt="" draggable={false} /> : <PlaceholderCover title={book.title} tag={book.tag} />}
      {(finished || (progress !== undefined && progress > 0)) && (
          <div className="cover-progress" data-testid="cover-progress" aria-label={finished ? 'Finished' : `${Math.round((progress ?? 0) * 100)}% read`}>
            {finished
              ? <motion.span className="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} />
              : <i style={{ transform: `scaleX(${progress ?? 0})` }} />}
          </div>
        )}
        {select?.selecting && (
          <span className={`select-bead ${select.selected ? 'on' : ''}`} aria-hidden="true">
            {select.selected && <motion.svg viewBox="0 0 16 16" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 16 }}><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#0f1420" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></motion.svg>}
          </span>
        )}
      </div>

      <div className="book-meta">
        <span className="book-title" title={book.title}>{book.title}</span>
        <span className="book-sub">
          <span className="tag-dot" style={{ background: TAG_COLOURS[book.tag] }} aria-hidden="true" />
          <span className="tag-name">{TAG_LABELS[book.tag]}</span>
          {book.author && <span className="author">{book.author}</span>}
        </span>
      </div>
    </motion.button>
  )
}
