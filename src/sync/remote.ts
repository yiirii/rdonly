import type { BaseRecord } from '../storage/types'

/** Opaque, server-ordered position in a collection's change stream (server time, never device time). */
export type Cursor = number
export type Unsubscribe = () => void
export interface PushResult { written: boolean; current?: BaseRecord }

export interface Remote {
  /** Write `rec` unless the cloud already has a record that wins over it; then that record comes back as `current`. */
  pushIfNewer(uid: string, col: string, rec: BaseRecord): Promise<PushResult>
  /** Everything changed after `cursor`, and the new cursor. */
  pullSince(uid: string, col: string, cursor: Cursor): Promise<{ recs: BaseRecord[]; cursor: Cursor }>
  /** Live changes after `cursor`. */
  watch(uid: string, col: string, cursor: Cursor, on: (recs: BaseRecord[], cursor: Cursor) => void, onError?: (e: unknown) => void): Unsubscribe
}

/** True for failures that mean "no connection right now" rather than "something is wrong". */
export function isOffline(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? ''
  const msg = String((e as Error)?.message ?? e)
  return /unavailable|network|offline|deadline-exceeded|failed to fetch/i.test(code + ' ' + msg) || (typeof navigator !== 'undefined' && navigator.onLine === false)
}
