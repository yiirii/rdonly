import { useSyncExternalStore } from 'react'

export type Route = { name: 'library' } | { name: 'reader'; bookId: string }

export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/read\/([0-9a-f]{64})$/)
  return m ? { name: 'reader', bookId: m[1] } : { name: 'library' }
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
  history.pushState({ fromLibrary: true }, '', `#/read/${id}`)
  notify()
}

export function closeReader() {
  if ((history.state as { fromLibrary?: boolean } | null)?.fromLibrary) { history.back(); return }
  history.replaceState(null, '', location.pathname + location.search)
  notify()
}
