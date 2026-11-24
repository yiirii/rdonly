import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { BookRecord } from '../../library/types'
import type { ProgressRecord } from '../../state/progress'
import { openBook } from '../../state/route'
import { requestRelink } from '../relink'
import { setOpenOrigin } from '../../reader/openOrigin'
import { PlaceholderCover } from '../PlaceholderCover'
import { coverTint } from './coverTint'

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

/** The last book you read, big, tinted with its own cover colour, with a few flat shapes tumbling behind it. */
export function ContinueCard({ book, progress, missing }: { book: BookRecord; progress?: ProgressRecord; missing?: boolean }) {
  const reduce = useReducedMotion()
  const [tint, setTint] = useState({ bg: '#22324a', deep: '#1a2638', accent: '#9fb4e6', shape: '#2b3d59' })
  useEffect(() => { void coverTint(book.coverThumb).then(setTint) }, [book.coverThumb])
  const pct = Math.round((progress?.percent ?? 0) * 100)
  const resume = (e: React.MouseEvent) => {
    if (missing) { requestRelink(book); return }
    const el = (e.currentTarget as HTMLElement).closest('[data-testid="continue-card"]')?.querySelector('.cc-cover')
    if (el) setOpenOrigin(el.getBoundingClientRect())
    openBook(book.id)
  }
  const spring = { type: 'spring' as const, stiffness: 260, damping: 14 }
  return (
    <motion.section className="continue" data-testid="continue-card" aria-label={`Continue reading ${book.title}`} style={{ background: tint.bg }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <motion.span className="cc-shape circle" style={{ background: tint.shape }} aria-hidden="true"
        initial={reduce ? false : { scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.12 }} />
      <motion.span className="cc-shape square" style={{ background: tint.shape }} aria-hidden="true"
        initial={reduce ? false : { y: -120, rotate: -70, opacity: 0 }} animate={{ y: 0, rotate: 18, opacity: 1 }} transition={{ ...spring, delay: 0.22 }} />
      <motion.span className="cc-shape tri" style={{ borderBottomColor: tint.deep }} aria-hidden="true"
        initial={reduce ? false : { x: 60, rotate: 90, opacity: 0 }} animate={{ x: 0, rotate: -12, opacity: 1 }} transition={{ ...spring, delay: 0.3 }} />
      <motion.button type="button" className="cc-cover" onClick={resume} aria-label={`Open ${book.title}`} tabIndex={-1}
        initial={reduce ? false : { y: -30, rotate: -6 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 12, delay: 0.05 }}>
        {book.coverThumb ? <img src={book.coverThumb} alt="" draggable={false} /> : <PlaceholderCover title={book.title} tag={book.tag} />}
      </motion.button>
      <div className="cc-meta">
        <span className="cc-label" style={{ color: tint.accent }}>Continue reading</span>
        <h2>{book.title}</h2>
        {book.author && <span className="cc-author">{book.author}</span>}
        <span className="cc-when">{pct}% · {progress ? ago(progress.updatedAt) : ''}</span>
        <div className="cc-bar" style={{ background: tint.deep }}><i style={{ background: tint.accent, transform: `scaleX(${pct / 100})` }} /></div>
        <button type="button" className="keycap primary cc-resume" onClick={resume}>Resume</button>
      </div>
    </motion.section>
  )
}
