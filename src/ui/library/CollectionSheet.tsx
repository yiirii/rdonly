import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { COLLECTION_COLOURS } from '../../library/collections'
import type { CollectionRecord } from '../../library/query'
import { libraryStore } from '../../state/library'
import { sheet } from '../motion'

/** New collection, or edit one (rename / colour / delete). */
export function CollectionSheet({ open, editing, onClose, onCreated }: { open: boolean; editing?: CollectionRecord; onClose(): void; onCreated?(c: CollectionRecord): void }) {
  const reduce = useReducedMotion()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLLECTION_COLOURS[0])
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? ''); setColor(editing?.color ?? COLLECTION_COLOURS[libraryStore().getState().collections.length % COLLECTION_COLOURS.length]); setErr(null); setConfirm(false)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [open, editing, onClose])
  const lib = libraryStore().getState()
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        if (name.trim() !== editing.name) await lib.renameCollection(editing.id, name)
        if (color !== editing.color) await lib.recolorCollection(editing.id, color)
      } else onCreated?.(await lib.newCollection(name, color))
      onClose()
    } catch (x) { setErr((x as Error).message) }
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1, pointerEvents: 'auto' }} exit={{ opacity: 0, pointerEvents: 'none' }}>
          <motion.section role="dialog" aria-modal="true" aria-label={editing ? `Edit ${editing.name}` : 'New collection'} className="sheet card small-sheet"
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { y: '100%' }} animate={reduce ? { opacity: 1 } : { y: 0 }} exit={reduce ? { opacity: 0 } : { y: '100%' }} transition={sheet}>
            <div className="sheet-grip" aria-hidden="true" />
            {confirm && editing ? (
              <div className="confirm">
                <h3>Delete “{editing.name}”?</h3>
                <p className="dim">The books stay in your library; only this collection goes.</p>
                <div className="confirm-row">
                  <button className="keycap" onClick={() => setConfirm(false)}>Cancel</button>
                  <button className="keycap danger" onClick={async () => { await lib.deleteCollection(editing.id); onClose() }}>Delete collection</button>
                </div>
              </div>
            ) : (
              <form className="edit-form" onSubmit={save}>
                <h3 className="sheet-title">{editing ? 'Edit collection' : 'New collection'}</h3>
                <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Want to read" /></label>
                <div className="colour-row" role="radiogroup" aria-label="Colour">
                  {COLLECTION_COLOURS.map((c) => (
                    <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} className={`colour ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
                  ))}
                </div>
                {err && <p className="error">{err}</p>}
                <div className="confirm-row">
                  {editing && <button type="button" className="keycap danger-text" onClick={() => setConfirm(true)}>Delete</button>}
                  <span style={{ flex: 1 }} />
                  <button type="button" className="keycap" onClick={onClose}>Cancel</button>
                  <button type="submit" className="keycap primary">{editing ? 'Save' : 'Create'}</button>
                </div>
              </form>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
