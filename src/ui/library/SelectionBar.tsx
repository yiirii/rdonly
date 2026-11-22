import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { CollectionRecord } from '../../library/query'
import { settle } from '../motion'

/** Bottom bar while selecting books: add to collection, tag, delete. */
export function SelectionBar({ count, open, collections, onDone, onAddTo, onTag, onDelete }: {
  count: number; open: boolean; collections: CollectionRecord[]; onDone(): void
  onAddTo(id: string): void; onTag(tag: string): void; onDelete(): void
}) {
  const [panel, setPanel] = useState<'none' | 'collections' | 'tag' | 'delete'>('none')
  const [tag, setTag] = useState('')
  const close = () => { setPanel('none'); setTag('') }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="selection-bar card" data-testid="selection-bar" role="toolbar" aria-label="Selected books"
          initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={settle}>
          {panel === 'none' && <>
            <motion.span key={count} className="sel-count" initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>{count}</motion.span>
            <span className="sel-label">selected</span>
            <button className="keycap" onClick={() => setPanel('collections')} disabled={!count}>Add to…</button>
            <button className="keycap" onClick={() => setPanel('tag')} disabled={!count}>Tag</button>
            <button className="keycap danger-text" onClick={() => setPanel('delete')} disabled={!count}>Delete</button>
            <button className="keycap primary" onClick={() => { close(); onDone() }}>Done</button>
          </>}
          {panel === 'collections' && <>
            {collections.length ? collections.map((c) => (
              <button key={c.id} className="keycap" onClick={() => { close(); onAddTo(c.id) }}><span className="tab-dot" style={{ background: c.color }} />{c.name}</button>
            )) : <span className="dim">Make a collection with + first.</span>}
            <button className="keycap" onClick={close}>Back</button>
          </>}
          {panel === 'tag' && (
            <form className="sel-tag" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) { onTag(tag.trim()); close() } }}>
              <input autoFocus value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag to add, e.g. fantasy" aria-label="Tag to add" />
              <button className="keycap primary" type="submit">Add tag</button>
              <button className="keycap" type="button" onClick={close}>Back</button>
            </form>
          )}
          {panel === 'delete' && <>
            <span className="sel-label">Delete {count} {count === 1 ? 'book' : 'books'}?</span>
            <button className="keycap" onClick={close}>Cancel</button>
            <button className="keycap danger" onClick={() => { close(); onDelete() }}>Delete</button>
          </>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
