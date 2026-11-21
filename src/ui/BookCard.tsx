import { motion, useReducedMotion } from 'framer-motion'
import type { BookRecord } from '../library/types'
import { PlaceholderCover } from './PlaceholderCover'
import { settle, TAG_COLOURS, TAG_LABELS } from './motion'

export function BookCard({ book, index }: { book: BookRecord; index: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.article
      layout={!reduce}
      className="book"
      data-testid="book-card"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...settle, delay: Math.min(index, 12) * 0.035 }}
    >
      <div className="book-cover">
        {book.coverThumb ? <img src={book.coverThumb} alt="" draggable={false} /> : <PlaceholderCover title={book.title} tag={book.tag} />}
      </div>
      <div className="book-meta">
        <h3 title={book.title}>{book.title}</h3>
        <p>
          <span className="tag-dot" style={{ background: TAG_COLOURS[book.tag] }} aria-hidden="true" />
          <span className="tag-name">{TAG_LABELS[book.tag]}</span>
          {book.author && <span className="author">{book.author}</span>}
        </p>
      </div>
    </motion.article>
  )
}
