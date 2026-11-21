export interface UpdaterOptions {
  currentVersion: string
  fetchVersion: () => Promise<string>
  isCalm: () => boolean
  reload: () => void
  /** periodic check while open; default 10 min */
  intervalMs?: number
  /** how often to re-check for a calm moment once an update is waiting; default 2 s */
  calmPollMs?: number
  /** Guard against reload loops: has a reload for this version already been tried this session? */
  alreadyTried?: (version: string) => boolean
  markTried?: (version: string) => void
}

export function isNewer(current: string, remote: string): boolean {
  const a = current.split('.').map(Number), b = remote.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0)
    if (d) return d > 0
  }
  return false
}

/** Nothing open, nothing being typed. */
export function defaultIsCalm(): boolean {
  if (document.querySelector('[role="dialog"]')) return false
  const el = document.activeElement as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return false
  return true
}

export function startUpdater(o: UpdaterOptions): () => void {
  let waiting: ReturnType<typeof setInterval> | undefined
  let done = false
  let target = ''
  const tryReload = () => {
    if (done || !o.isCalm()) return
    done = true
    if (waiting) clearInterval(waiting)
    o.markTried?.(target)
    o.reload()
  }
  const check = async () => {
    if (done || waiting) return
    try {
      target = (await o.fetchVersion()).trim()
      if (!isNewer(o.currentVersion, target)) return
    } catch { return } // offline or server hiccup: try again later
    if (o.alreadyTried?.(target)) return
    tryReload()
    if (!done) waiting = setInterval(tryReload, o.calmPollMs ?? 2000)
  }
  const onVisible = () => { if (document.visibilityState === 'visible') void check() }
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(() => void check(), o.intervalMs ?? 10 * 60_000)
  void check()
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
    if (waiting) clearInterval(waiting)
  }
}
