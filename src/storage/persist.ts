export type PersistState = 'granted' | 'denied' | 'unsupported'

/** Ask the browser (iOS Safari included) to never evict our storage. */
export async function requestPersistence(): Promise<PersistState> {
  const s = navigator.storage
  if (!s?.persist) return 'unsupported'
  try {
    if (await s.persisted?.()) return 'granted'
    return (await s.persist()) ? 'granted' : 'denied'
  } catch { return 'denied' }
}

/** Read the current state without prompting. */
export async function persistStatus(): Promise<PersistState> {
  const s = navigator.storage
  if (!s?.persisted) return 'unsupported'
  try { return (await s.persisted()) ? 'granted' : 'denied' } catch { return 'denied' }
}
