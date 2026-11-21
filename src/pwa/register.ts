import { bridge } from '../storage/types'
import { startUpdater } from './updater'
import { appIsCalm } from '../state/calm'

declare const __APP_VERSION__: string
export const APP_VERSION = __APP_VERSION__

/** Browser/iPhone only: offline service worker + quiet self-update. */
export function setupPwa() {
  if (bridge() || !('serviceWorker' in navigator) || !import.meta.env.PROD) return
  const swUrl = `${import.meta.env.BASE_URL}sw.js`
  let reg: ServiceWorkerRegistration | undefined
  navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' }).then((r) => { reg = r }).catch(() => {})
  startUpdater({
    currentVersion: APP_VERSION,
    fetchVersion: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
      return ((await res.json()) as { version: string }).version
    },
    isCalm: () => appIsCalm(),
    reload: () => { void (reg?.update() ?? Promise.resolve()).finally(() => location.reload()) },
  })
}
