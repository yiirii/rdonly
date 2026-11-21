import type { ReaderModeName } from '../reader/modes'
import type { BaseRecord, RecordStore } from '../storage/types'

export interface ProgressRecord extends BaseRecord { locator: string; percent: number; mode: ReaderModeName }
type Position = Pick<ProgressRecord, 'locator' | 'percent' | 'mode'>

/** Throttled progress writes: first position at once, then at most one write per interval; flush() on leave. */
export function createProgressSaver(records: RecordStore, bookId: string, opts: { intervalMs?: number; now?: () => number } = {}) {
  const interval = opts.intervalMs ?? 15_000
  const now = opts.now ?? Date.now
  let latest: Position | undefined
  let written: string | undefined
  let lastWrite = -Infinity
  let timer: ReturnType<typeof setTimeout> | undefined
  let chain: Promise<void> = Promise.resolve()

  const write = () => {
    if (timer) { clearTimeout(timer); timer = undefined }
    if (!latest) return chain
    const key = `${latest.locator}|${latest.mode}`
    if (key === written) return chain
    written = key
    lastWrite = now()
    const rec: ProgressRecord = { id: bookId, updatedAt: lastWrite, ...latest }
    chain = chain.then(() => records.put('progress', rec)).catch(() => { written = undefined })
    return chain
  }
  return {
    update(p: Position) {
      latest = p
      if (timer) return
      const wait = Math.max(0, lastWrite + interval - now())
      timer = setTimeout(() => { timer = undefined; void write() }, wait)
    },
    flush: () => write(),
  }
}

export const loadProgress = (records: RecordStore, bookId: string) => records.get<ProgressRecord>('progress', bookId)
