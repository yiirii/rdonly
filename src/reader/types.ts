import type { BookRecord } from '../library/types'
import type { ProgressRecord } from '../state/progress'

export interface ChromeControl { visible: boolean; toggle(): void; hide(): void; poke(): void }

export interface ReaderModeProps {
  book: BookRecord
  file: Blob
  initial?: ProgressRecord
  onProgress(p: { locator: string; percent: number; label?: string }): void
  chrome: ChromeControl
}
