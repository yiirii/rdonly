import type { BookFormat } from '../core/formats'
import type { BookTag } from '../core/tags'
import type { BaseRecord } from '../storage/types'

export interface BookRecord extends BaseRecord {
  title: string
  author?: string
  series?: string
  volume?: number
  format: BookFormat
  tag: BookTag
  modeOverride?: string
  /** data URL of a ≤40KB thumbnail; synced so other devices can show the cover */
  coverThumb?: string
  fileName: string
  fileSize: number
  addedAt: number
}

export type ImportStatus = 'added' | 'relinked' | 'duplicate' | 'unsupported' | 'error'
export interface ImportResult { fileName: string; status: ImportStatus; bookId?: string; message?: string }
