import { useSyncExternalStore } from 'react'

export type Route = { name: 'library' } | { name: 'reader'; bookId: string; series?: string } | { name: 'series'; key: string }

const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return null } }
const encode = (s: string) => { try { return encodeURIComponent(s) } catch { return encodeURIComponent(s.replace(/[\uD800-\uDFFF]/g, '')) } }

export function parseRoute(hash: string): Route {
  const r = hash.match(/^#\/(?:series\/([^/]+)\/)?read\/([0-9a-f]{64})$/)
  if (r) { const series = r[1] ? decode(r[1]) : undefined; if (series === null) return { name: 'library' }; return { name: 'reader', bookId: r[2], ...(series ? { series } : {}) } }
  const s = hash.match(/^#\/series\/([^/]+)$/)
  if (s) { const key = decode(s[1]); return key === null ? { name: 'library' } : { name: 'series', key } }
  return { name: 'library' }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb); window.addEventListener('popstate', cb)
  return () => { window.removeEventListener('hashchange', cb); window.removeEventListener('popstate', cb) }
}
let cached: { hash: string; route: Route } | undefined
const snapshot = () => {
  if (cached?.hash !== location.hash) cached = { hash: location.hash, route: parseRoute(location.hash) }
  return cached.route
}
export const useRoute = () => useSyncExternalStore(subscribe, snapshot)

const notify = () => window.dispatchEvent(new PopStateEvent('popstate'))

export function openBook(id: string) {
  // Opened from inside a series folder: the folder stays underneath and Back returns to it.
  const inSeries = parseRoute(location.hash)
  const prefix = inSeries.name === 'series' ? `#/series/${encode(inSeries.key)}/` : '#/'
  history.pushState({ fromLibrary: true }, '', `${prefix}read/${id}`)
  notify()
}

export function openSeries(key: string) {
  history.pushState({ fromLibrary: true }, '', `#/series/${encode(key)}`)
  notify()
}

export function closeReader() {
  if ((history.state as { fromLibrary?: boolean } | null)?.fromLibrary) { history.back(); return }
  const r = parseRoute(location.hash)
  const to = r.name === 'reader' && r.series ? `#/series/${encode(r.series)}` : location.pathname + location.search
  history.replaceState(null, '', to)
  notify()
}
export const closeSeries = closeReader
