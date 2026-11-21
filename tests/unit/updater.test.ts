import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startUpdater, isNewer } from '../../src/pwa/updater'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('isNewer', () => {
  it.each([['0.1.0', '0.1.1', true], ['0.1.9', '0.1.10', true], ['0.2.0', '0.1.9', false], ['0.1.0', '0.1.0', false]])(
    '%s → %s newer=%s', (cur, remote, want) => expect(isNewer(cur, remote)).toBe(want))
})

describe('startUpdater', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }))
  afterEach(() => vi.useRealTimers())

  it('reloads once when a newer build exists and the app is calm', async () => {
    const reload = vi.fn()
    const stop = startUpdater({ currentVersion: '0.1.0', fetchVersion: async () => '0.1.1', isCalm: () => true, reload })
    await flush(); await flush()
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
  })
  it('waits for a calm moment before reloading', async () => {
    const reload = vi.fn()
    let calm = false
    const stop = startUpdater({ currentVersion: '0.1.0', fetchVersion: async () => '0.1.1', isCalm: () => calm, reload, calmPollMs: 1000 })
    await flush(); await flush()
    expect(reload).not.toHaveBeenCalled()
    calm = true
    vi.advanceTimersByTime(1000)
    expect(reload).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
  })
  it('never reloads when the version is the same', async () => {
    const reload = vi.fn()
    const stop = startUpdater({ currentVersion: '0.1.0', fetchVersion: async () => '0.1.0', isCalm: () => true, reload, intervalMs: 100 })
    await flush(); vi.advanceTimersByTime(1000); await flush()
    expect(reload).not.toHaveBeenCalled()
    stop()
  })
  it('stays quiet when offline', async () => {
    const reload = vi.fn()
    const stop = startUpdater({ currentVersion: '0.1.0', fetchVersion: async () => { throw new TypeError('Failed to fetch') }, isCalm: () => true, reload })
    await flush(); await flush()
    expect(reload).not.toHaveBeenCalled()
    stop()
  })
  it('checks again when the app returns to the foreground', async () => {
    const fetchVersion = vi.fn(async () => '0.1.0')
    const stop = startUpdater({ currentVersion: '0.1.0', fetchVersion, isCalm: () => true, reload: vi.fn() })
    await flush()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(fetchVersion).toHaveBeenCalledTimes(2)
    stop()
  })
})

describe('isCalm', () => {
  it('is false while a dialog is open or a field has focus', async () => {
    const { defaultIsCalm } = await import('../../src/pwa/updater')
    document.body.innerHTML = ''
    expect(defaultIsCalm()).toBe(true)
    document.body.innerHTML = '<div role="dialog"></div>'
    expect(defaultIsCalm()).toBe(false)
    document.body.innerHTML = '<input id="i">'
    ;(document.getElementById('i') as HTMLInputElement).focus()
    expect(defaultIsCalm()).toBe(false)
  })
})
