import { motion, useReducedMotion } from 'framer-motion'
import type { BookRecord } from '../library/types'
import { openSeries } from '../state/route'
import { PlaceholderCover } from './PlaceholderCover'
import { settle, TAG_COLOURS, TAG_LABELS } from './motion'

const Cover = ({ book }: { book: BookRecord }) =>
  book.coverThumb ? <img src={book.coverThumb} alt="" draggable={false} /> : <PlaceholderCover title={book.title} tag={book.tag} />

/** A series folder: the first volume's cover with the next ones stacked behind it, and a folder tab with the count. */
export function SeriesCard({ name, seriesKey, books, index, cols }: { name: string; seriesKey: string; books: BookRecord[]; index: number; cols?: number }) {
  const reduce = useReducedMotion()
  const behind = books.slice(1, 3).reverse()
  return (
    <motion.button type="button" layout={!reduce} layoutDependency={`${cols}:${index}`} className="book series" data-testid="series-card" aria-label={`Open series ${name}, ${books.length} books`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ ...settle, delay: Math.min(index, 12) * 0.035 }}
      whileHover={reduce ? undefined : 'fan'} whileFocus={reduce ? undefined : 'fan'}
      onClick={() => openSeries(seriesKey)}>
      <div className="stack">
        {behind.map((b, i) => {
          const depth = behind.length - i // 2 = furthest back
          return (
            <motion.div key={b.id} className="book-cover stacked" aria-hidden="true"
              style={{ zIndex: 3 - depth }}
              initial={false}
              animate={{ x: depth * 7, y: -depth * 7, rotate: depth * 2.5 }}
              variants={{ fan: { x: depth * 12, y: -depth * 10, rotate: depth * 5 } }}
              transition={settle}>
              <Cover book={b} />
            </motion.div>
          )
        })}
        <div className="book-cover front"><Cover book={books[0]} /></div>
        <span className="folder-tab" aria-hidden="true">{books.length}</span>
      </div>
      <div className="book-meta">
        <span className="book-title">{name}</span>
        <span className="book-sub">
          <span className="tag-dot" style={{ background: TAG_COLOURS[books[0].tag] }} aria-hidden="true" />
          <span className="tag-name">{TAG_LABELS[books[0].tag]}</span>
          <span className="author">{books.length} volumes</span>
        </span>
      </div>
    </motion.button>
  )
}
