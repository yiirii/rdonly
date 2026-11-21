import { describe, it, expect, afterEach, vi } from 'vitest'
import { createIdbFileStore } from '../../src/storage/files'
import { requestPersistence } from '../../src/storage/persist'

let n = 0
const fresh = () => createIdbFileStore(`files-${++n}`)
const bytes = (...b: number[]) => new Uint8Array(b)

describe('IndexedDB file store', () => {
  it('stores and returns bytes', async () => {
    const s = fresh()
    await s.put('h1', 'epub', bytes(1, 2, 3))
    expect(Array.from((await s.get('h1'))!)).toEqual([1, 2, 3])
    expect(await s.has('h1')).toBe(true)
  })
  it('reports unknown ids as missing', async () => {
    const s = fresh()
    expect(await s.get('nope')).toBeUndefined()
    expect(await s.has('nope')).toBe(false)
  })
  it('removes files', async () => {
    const s = fresh()
    await s.put('h1', 'pdf', bytes(9))
    await s.remove('h1')
    expect(await s.has('h1')).toBe(false)
  })
  it('counts used bytes', async () => {
    const s = fresh()
    await s.put('a', 'cbz', bytes(1, 2, 3, 4))
    expect((await s.usage()).usedBytes).toBeGreaterThanOrEqual(4)
  })
})

describe('requestPersistence', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('returns granted when the browser agrees', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: { persist: async () => true, persisted: async () => false } })
    expect(await requestPersistence()).toBe('granted')
  })
  it('returns denied when the browser refuses', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: { persist: async () => false, persisted: async () => false } })
    expect(await requestPersistence()).toBe('denied')
  })
  it('returns unsupported without the API', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: undefined })
    expect(await requestPersistence()).toBe('unsupported')
  })
})
