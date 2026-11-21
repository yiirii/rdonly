import { createStore, useStore } from 'zustand'
import { importFiles, type ImportDeps } from '../library/importBooks'
import type { BookRecord, ImportResult } from '../library/types'
import { getRecordStore } from '../storage/select'
import { getFileStore } from '../storage/files'

export type SortKey = 'recent' | 'title'

interface LibraryState {
  loaded: boolean
  all: BookRecord[]
  books: BookRecord[]
  sort: SortKey
  busy: boolean
  load(): Promise<void>
  import(files: File[]): Promise<ImportResult[]>
  setSort(s: SortKey): void
}

const sorters: Record<SortKey, (a: BookRecord, b: BookRecord) => number> = {
  recent: (a, b) => b.addedAt - a.addedAt,
  title: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
}
const sorted = (all: BookRecord[], s: SortKey) => [...all].sort(sorters[s])

export function createLibraryStore(deps: ImportDeps) {
  let queue: Promise<unknown> = Promise.resolve()
  let pending = 0
  return createStore<LibraryState>()((set, get) => ({
    loaded: false, all: [], books: [], sort: 'recent', busy: false,
    async load() {
      const all = await deps.records.list<BookRecord>('books')
      set({ all, books: sorted(all, get().sort), loaded: true })
    },
    /** Imports are queued: a drop during an import waits its turn instead of running alongside. */
    import(files) {
      pending++
      set({ busy: true })
      const run = queue.then(async () => {
        try {
          const results = await importFiles(files.map((f) => ({ name: f.name, read: async () => new Uint8Array(await f.arrayBuffer()) })), deps)
          await get().load()
          return results
        } finally { if (--pending === 0) set({ busy: false }) }
      })
      queue = run.catch(() => {})
      return run
    },
    setSort(sort) { set({ sort, books: sorted(get().all, sort) }) },
  }))
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
