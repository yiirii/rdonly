import { createStore, useStore } from 'zustand'
import { importFiles, type ImportDeps, type ImportItem } from '../library/importBooks'
import { folderToCbz } from '../library/folder'
import { deleteBook, updateBook, type BookPatch } from '../library/editBook'
import type { BookRecord, ImportResult } from '../library/types'
import { getRecordStore } from '../storage/select'
import { getFileStore } from '../storage/files'

import type { CollectionItemRecord, CollectionRecord, SortKey } from '../library/query'
import type { ProgressRecord } from './progress'
import { addBooksTo, createCollection, deleteCollection, liveCollections, recolorCollection, renameCollection, reorderCollections, setMembership } from '../library/collections'
import type { BookTag } from '../core/tags'
export type { SortKey }

interface LibraryState {
  loaded: boolean
  all: BookRecord[]
  books: BookRecord[]
  progress: ProgressRecord[]
  collections: CollectionRecord[]
  items: CollectionItemRecord[]
  sort: SortKey
  tab: string
  types: BookTag[]
  search: string
  setTab(t: string): void
  toggleType(t: BookTag): void
  setSearch(s: string): void
  newCollection(name: string, color?: string): Promise<CollectionRecord>
  renameCollection(id: string, name: string): Promise<void>
  recolorCollection(id: string, color: string): Promise<void>
  reorderCollections(ids: string[]): Promise<void>
  deleteCollection(id: string): Promise<void>
  setMembership(collectionId: string, bookId: string, member: boolean): Promise<void>
  addToCollection(collectionId: string, bookIds: string[]): Promise<void>
  removeMany(ids: string[]): Promise<void>
  busy: boolean
  load(): Promise<void>
  import(files: File[]): Promise<ImportResult[]>
  importFolder(files: File[]): Promise<ImportResult[]>
  update(id: string, patch: BookPatch): Promise<BookRecord>
  remove(id: string): Promise<void>
  setSort(s: SortKey): void
}

const sorters: Record<SortKey, (a: BookRecord, b: BookRecord) => number> = {
  added: (a, b) => b.addedAt - a.addedAt,
  read: (a, b) => b.addedAt - a.addedAt,
  title: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
}
const sorted = (all: BookRecord[], s: SortKey) => [...all].sort(sorters[s])

export function createLibraryStore(deps: ImportDeps) {
  let queue: Promise<unknown> = Promise.resolve()
  let pending = 0
  let loadSeq = 0 // only the newest load may write its results
  const store = createStore<LibraryState>()((set, get) => ({
    loaded: false, all: [], books: [], progress: [], collections: [], items: [], sort: 'added', tab: 'all', types: [], search: '', busy: false,
    async load() {
      const my = ++loadSeq
      const r = deps.records
      const [all, progress, collections, items] = await Promise.all([
        r.list<BookRecord>('books'), r.list<ProgressRecord>('progress'), liveCollections(r), r.list<CollectionItemRecord>('collectionItems'),
      ])
      if (my !== loadSeq) return
      const tab = get().tab
      const tabOk = ['all', 'reading', 'new', 'finished'].includes(tab) || collections.some((c) => c.id === tab)
      set({ all, books: sorted(all, get().sort), progress, collections, items, loaded: true, ...(tabOk ? {} : { tab: 'all' }) })
    },
    setTab(tab) { set({ tab }) },
    toggleType(t) { const ts = get().types; set({ types: ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t] }) },
    setSearch(search) { set({ search }) },
    async newCollection(name, color) { const c = await createCollection(deps.records, name, color); await get().load(); return c },
    async renameCollection(id, name) { await renameCollection(deps.records, id, name); await get().load() },
    async recolorCollection(id, color) { await recolorCollection(deps.records, id, color); await get().load() },
    async reorderCollections(ids) {
      const byId = new Map(get().collections.map((c) => [c.id, c]))
      set({ collections: ids.map((id, i) => ({ ...byId.get(id)!, order: i })) }) // feels instant while dragging
      await reorderCollections(deps.records, ids)
    },
    async deleteCollection(id) { await deleteCollection(deps.records, id); if (get().tab === id) set({ tab: 'all' }); await get().load() },
    async setMembership(cid, bid, m) { await setMembership(deps.records, cid, bid, m); await get().load() },
    async addToCollection(cid, ids) { await addBooksTo(deps.records, cid, ids); await get().load() },
    async removeMany(ids) { for (const id of ids) await deleteBook(deps.records, deps.files, id); await get().load() },
    /** Imports are queued: a drop during an import waits its turn instead of running alongside. */
    import(files) {
      return run(files.map((f) => ({ name: f.name, read: async () => new Uint8Array(await f.arrayBuffer()) })))
    },
    importFolder(files) {
      const item = folderToCbz(files)
      return item ? run([item]) : Promise.resolve([{ fileName: 'folder', status: 'unsupported' as const, message: 'No images in that folder' }])
    },
    async update(id, patch) {
      const b = await updateBook(deps.records, id, patch, deps.now)
      const all = get().all.map((x) => (x.id === id ? b : x))
      set({ all, books: sorted(all, get().sort) })
      return b
    },
    async remove(id) {
      await deleteBook(deps.records, deps.files, id)
      await get().load()
    },
    setSort(sort: SortKey) { set({ sort, books: sorted(get().all, sort) }) },
  }))
  function run(items: ImportItem[]) {
    pending++
    store.setState({ busy: true })
    const go = queue.then(async () => {
      try {
        const results = await importFiles(items, deps)
        await store.getState().load()
        return results
      } finally { if (--pending === 0) store.setState({ busy: false }) }
    })
    queue = go.catch(() => {})
    return go
  }
  return store
}

let appStore: ReturnType<typeof createLibraryStore> | undefined
export const libraryStore = () => (appStore ??= createLibraryStore({ records: getRecordStore(), files: getFileStore() }))
export function useLibrary<T>(sel: (s: LibraryState) => T): T { return useStore(libraryStore(), sel) }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Plain-sentence summary of an import batch for the toast. */
export function summarize(results: ImportResult[]): string {
  const by = (s: ImportResult['status']) => results.filter((r) => r.status === s)
  const parts: string[] = []
  const added = by('added').length, relinked = by('relinked').length, dup = by('duplicate').length
  if (added) parts.push(`Added ${plural(added, 'book', 'books')}.`)
  if (relinked) parts.push(`Restored the file for ${plural(relinked, 'book', 'books')}.`)
  if (dup) parts.push(`${dup} ${dup === 1 ? 'was' : 'were'} already in your library.`)
  const bad = [...by('unsupported'), ...by('error')]
  if (bad.length) {
    const names = bad.slice(0, 2).map((r) => r.fileName).join(' and ')
    parts.push(`Couldn’t open ${names}${bad.length > 2 ? ` and ${bad.length - 2} more` : ''}.`)
  }
  return parts.join(' ')
}
