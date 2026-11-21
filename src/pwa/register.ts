import { bridge } from '../storage/types'
import { appIsCalm } from '../state/calm'
import { startUpdater } from './updater'

declare const __APP_VERSION__: string
export const APP_VERSION = __APP_VERSION__
const TRIED_KEY = 'rdonly.updateTried'

/** Let the waiting worker take over, then reload once it controls the page. */
async function activateAndReload(reg: ServiceWorkerRegistration | undefined) {
  try { await reg?.update() } catch { /* offline: plain reload still picks up the new page */ }
  const waiting = reg?.waiting
  if (!waiting) { location.reload(); return }
  const done = () => location.reload()
  navigator.serviceWorker.addEventListener('controllerchange', done, { once: true })
  setTimeout(done, 3000) // never hang if the event doesn't arrive
  waiting.postMessage('SKIP_WAITING')
}

/** Browser/iPhone only: offline service worker + quiet self-update. */
export function setupPwa() {
  if (bridge() || !('serviceWorker' in navigator) || !import.meta.env.PROD) return
  let reg: ServiceWorkerRegistration | undefined
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).then((r) => { reg = r }).catch(() => {})
  startUpdater({
    currentVersion: APP_VERSION,
    fetchVersion: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
      return ((await res.json()) as { version: string }).version
    },
    isCalm: () => appIsCalm(),
    reload: () => void activateAndReload(reg),
    alreadyTried: (v) => { try { return sessionStorage.getItem(TRIED_KEY) === v } catch { return false } },
    markTried: (v) => { try { sessionStorage.setItem(TRIED_KEY, v) } catch { /* ignore */ } },
  })
}
