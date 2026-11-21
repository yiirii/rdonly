import type { ReactNode } from 'react'
import type { BookRecord } from '../library/types'
import type { ProgressRecord } from '../state/progress'

export interface ChromeControl {
  visible: boolean; toggle(): void; hide(): void; poke(): void
  /** Mouse moved to this height (window coordinates): near the top or bottom edge shows the bars. */
  reveal(clientY: number): void
  /** The pointer is resting on a bar: don't auto-hide while true. */
  hold(on: boolean): void
}

export interface ReaderModeProps {
  book: BookRecord
  file: Blob
  initial?: ProgressRecord
  onProgress(p: { locator: string; percent: number; label?: string }): void
  chrome: ChromeControl
  /** The book couldn't be shown; the reader takes over with a message and a way back. */
  onError(message: string): void
  /** Extra controls a mode puts in the bars (e.g. the novel's Aa button and slider). */
  setChromeExtras(x: { right?: ReactNode; bottom?: ReactNode; tone?: 'light' | 'dark' }): void
}
