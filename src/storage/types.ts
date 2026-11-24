export interface BaseRecord { id: string; updatedAt: number; deleted?: true }

export interface RecordStore {
  get<T extends BaseRecord>(col: string, id: string): Promise<T | undefined>
  put<T extends BaseRecord>(col: string, rec: T): Promise<void>
  list<T extends BaseRecord>(col: string, opts?: { includeDeleted?: boolean }): Promise<T[]>
  /** Writes a tombstone so the delete can sync. */
  remove(col: string, id: string): Promise<void>
}

export interface FileStore {
  put(id: string, ext: string, bytes: Uint8Array): Promise<void>
  get(id: string): Promise<Uint8Array | undefined>
  /** For reading: a Blob lets readers slice what they need instead of loading the whole book. */
  getBlob(id: string): Promise<Blob | undefined>
  has(id: string): Promise<boolean>
  /** Ids of every book file on this device, in one go. */
  ids(): Promise<string[]>
  remove(id: string): Promise<void>
  usage(): Promise<{ usedBytes: number; quotaBytes?: number }>
}

/** Shape exposed by the Electron preload as window.rdonly */
export interface RdOnlyBridge {
  platform: 'electron'
  records: RecordStore
  files: Omit<FileStore, 'getBlob'>
  /** Called when the window is closing; the window waits (briefly) for the returned promise. */
  onBeforeClose?(save: () => Promise<void>): void
}

export function bridge(): RdOnlyBridge | undefined {
  return (globalThis as unknown as { rdonly?: RdOnlyBridge }).rdonly
}

/** Tombstone timestamp is always strictly newer than what it replaces. */
export function tombstoneTime(prev: number | undefined): number {
  return Math.max(Date.now(), (prev ?? 0) + 1)
}
