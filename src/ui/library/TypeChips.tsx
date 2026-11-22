import { AnimatePresence, motion } from 'framer-motion'
import type { BookTag } from '../../core/tags'
import { TAG_COLOURS, TAG_LABELS } from '../motion'

const TAGS: BookTag[] = ['novel', 'manga', 'webtoon', 'comic', 'document']
export function TypeChips({ types, onToggle }: { types: BookTag[]; onToggle(t: BookTag): void }) {
  return (
    <div className={`chips ${types.length ? 'filtering' : ''}`} role="group" aria-label="Show types">
      {TAGS.map((t) => {
        const on = types.includes(t)
        return (
          <button key={t} type="button" role="checkbox" aria-checked={on} className={`chip ${on ? 'on' : ''}`} onClick={() => onToggle(t)}>
            <span className="chip-dot" style={{ background: TAG_COLOURS[t] }} aria-hidden="true">
              <AnimatePresence>{on && <motion.span className="chip-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }} />}</AnimatePresence>
            </span>
            {TAG_LABELS[t]}
          </button>
        )
      })}
    </div>
  )
}
