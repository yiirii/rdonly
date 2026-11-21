import { defaultIsCalm } from '../pwa/updater'
import { libraryStore } from './library'

/** Safe moment to reload for an update: nothing open, nothing typed, no import running. */
export function appIsCalm(store: { getState(): { busy: boolean } } = libraryStore()): boolean {
  return defaultIsCalm() && !store.getState().busy
}
