import { motion, useReducedMotion } from 'framer-motion'
import type { BookRecord } from '../library/types'
import { openBook } from '../state/route'
import { setOpenOrigin } from '../reader/openOrigin'
import { PlaceholderCover } from './PlaceholderCover'
import { settle, TAG_COLOURS, TAG_LABELS } from './motion'

export function BookCard({ book, index }: { book: BookRecord; index: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      layout={!reduce}
      className="book"
      data-testid="book-card"
      aria-label={`Open ${book.title}`}
      onClick={(e) => { setOpenOrigin(e.currentTarget.querySelector('.book-cover')!.getBoundingClientRect()); openBook(book.id) }}
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
