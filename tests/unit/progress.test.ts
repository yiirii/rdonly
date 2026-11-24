import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProgressSaver, type ProgressRecord } from '../../src/state/progress'
import { memRecords } from './fakes'

let records: ReturnType<typeof memRecords>, writes: ProgressRecord[], t: number
beforeEach(() => {
  vi.useFakeTimers()
  records = memRecords(); writes = []; t = 1000
  const put = records.put
  records.put = async (c, r) => { writes.push(r as unknown as ProgressRecord); return put(c, r) }
})
afterEach(() => vi.useRealTimers())
const saver = () => createProgressSaver(records, 'book1', { intervalMs: 15_000, now: () => t })
const p = (n: number) => ({ locator: `page:${n}`, percent: n / 10, mode: 'paged-ltr' as const })

describe('progress saver', () => {
  it('writes the first position right away', async () => {
    const s = saver(); s.update(p(1)); await vi.runOnlyPendingTimersAsync()
    expect(writes.map((w) => w.locator)).toEqual(['page:1'])
    expect(writes[0]).toMatchObject({ id: 'book1', percent: 0.1, mode: 'paged-ltr', updatedAt: 1000 })
  })
  it('writes at most once per interval, keeping the latest', async () => {
    const s = saver(); s.update(p(1)); await vi.advanceTimersByTimeAsync(0)
    t = 2000; s.update(p(2)); t = 3000; s.update(p(3))
    await vi.advanceTimersByTimeAsync(5000)
    expect(writes).toHaveLength(1)
    t = 16_000; await vi.advanceTimersByTimeAsync(10_000)
    expect(writes.map((w) => w.locator)).toEqual(['page:1', 'page:3'])
  })
  it('flush writes the pending position immediately', async () => {
    const s = saver(); s.update(p(1)); await vi.advanceTimersByTimeAsync(0)
    s.update(p(4)); await s.flush()
    expect(writes.map((w) => w.locator)).toEqual(['page:1', 'page:4'])
  })
  it('does not write when nothing changed', async () => {
    const s = saver(); s.update(p(1)); await vi.advanceTimersByTimeAsync(0)
    s.update(p(1)); await s.flush(); await vi.advanceTimersByTimeAsync(60_000)
    expect(writes).toHaveLength(1)
  })
  it('a save is always stamped newer than the place already stored (a device with a slow clock still wins)', async () => {
    await records.put<ProgressRecord>('progress', { id: 'book1', updatedAt: 999_999, locator: 'from-laptop', percent: 0.5, mode: 'novel' })
    const s = saver(); s.update({ locator: 'here', percent: 0.6, mode: 'novel' }); await s.flush()
    const r = (await records.get<ProgressRecord>('progress', 'book1'))!
    expect(r.locator).toBe('here')
    expect(r.updatedAt).toBeGreaterThan(999_999)
  })
})
