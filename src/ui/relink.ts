import type { BookRecord } from '../library/types'

/** Ask the library to pick the file for a book that isn't on this device yet. */
let handler: ((b: BookRecord) => void) | undefined
export const onRelinkRequest = (fn: (b: BookRecord) => void) => { handler = fn; return () => { if (handler === fn) handler = undefined } }
export const requestRelink = (b: BookRecord) => handler?.(b)
