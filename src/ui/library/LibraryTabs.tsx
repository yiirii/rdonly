import { motion, Reorder, useReducedMotion } from 'framer-motion'
import type { CollectionRecord } from '../../library/query'

const BUILT_IN = [['all', 'All'], ['reading', 'Reading'], ['new', 'Not started'], ['finished', 'Finished']] as const

export function LibraryTabs({ tab, counts, collections, onTab, onNew, onTabMenu, onReorder, onDropBooks }: {
  tab: string; counts: Record<string, number>; collections: CollectionRecord[]
  onTab(t: string): void; onNew(): void; onTabMenu(c: CollectionRecord, at: { x: number; y: number }): void
  onReorder(ids: string[]): void; onDropBooks(collectionId: string, bookIds: string[]): void
}) {
  const reduce = useReducedMotion()
  const pill = (id: string) => tab === id && (
    <motion.span layoutId="tab-pill" className="tab-pill" aria-hidden="true"
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 }} />
  )
  const button = (id: string, label: string, dot?: string) => (
    <button type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => onTab(id)}
      data-collection={dot ? id : undefined}
      onDragOver={dot ? (e) => { if (e.dataTransfer.types.includes('application/x-rdonly-books')) { e.preventDefault(); e.currentTarget.classList.add('drop') } } : undefined}
      onDragLeave={dot ? (e) => e.currentTarget.classList.remove('drop') : undefined}
      onDrop={dot ? (e) => { e.preventDefault(); e.currentTarget.classList.remove('drop'); const ids = e.dataTransfer.getData('application/x-rdonly-books'); if (ids) onDropBooks(id, JSON.parse(ids)) } : undefined}>
      {pill(id)}
      <span className="tab-text">{dot && <span className="tab-dot" style={{ background: dot }} />}{label}<small>{counts[id] ?? 0}</small></span>
    </button>
  )
  let press: ReturnType<typeof setTimeout> | undefined
  return (
    <div className="tabs-row">
      <div className="tabs" role="tablist" aria-label="Shelves">
        {BUILT_IN.map(([id, label]) => <span key={id}>{button(id, label)}</span>)}
        <Reorder.Group as="div" axis="x" values={collections.map((c) => c.id)} onReorder={onReorder} className="tabs-reorder">
          {collections.map((c) => (
            <Reorder.Item as="div" key={c.id} value={c.id} className="tab-item"
              onContextMenu={(e) => { e.preventDefault(); onTabMenu(c, { x: e.clientX, y: e.clientY }) }}
              onPointerDown={(e) => { const at = { x: e.clientX, y: e.clientY }; press = setTimeout(() => onTabMenu(c, at), 520) }}
              onPointerUp={() => clearTimeout(press)} onPointerLeave={() => clearTimeout(press)} onDragStart={() => clearTimeout(press)}>
              {button(c.id, c.name, c.color)}
            </Reorder.Item>
          ))}
        </Reorder.Group>
        <button type="button" className="tab add" aria-label="New collection" onClick={onNew}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="7" y="2" width="2" height="12" rx="1" fill="currentColor" /><rect x="2" y="7" width="12" height="2" rx="1" fill="currentColor" /></svg>
        </button>
      </div>
    </div>
  )
}
