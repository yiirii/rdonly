import { motion, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import type { BookRecord } from '../library/types'
import { openBook } from '../state/route'
import { setOpenOrigin } from '../reader/openOrigin'
import { PlaceholderCover } from './PlaceholderCover'
import { settle, TAG_COLOURS, TAG_LABELS } from './motion'

export function BookCard({ book, index, onActions }: { book: BookRecord; index: number; onActions(b: BookRecord): void }) {
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
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const p = { fired: false, x: e.clientX, y: e.clientY, timer: setTimeout(() => { p.fired = true; navigator.vibrate?.(10); onActions(book) }, 450) }
        press.current = p
      }}
      onPointerMove={(e) => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress() }}
      onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); cancelPress(); if (!press.current?.fired) onActions(book) }}
      onClick={(e) => {
        if (press.current?.fired) { press.current = null; return }
        setOpenOrigin(e.currentTarget.querySelector('.book-cover')!.getBoundingClientRect()); openBook(book.id)
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...settle, delay: Math.min(index, 12) * 0.035 }}
    >
      <div className="book-cover">
        {book.coverThumb ? <img src={book.coverThumb} alt="" draggable={false} /> : <PlaceholderCover title={book.title} tag={book.tag} />}
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
