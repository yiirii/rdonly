import { unzipSync } from 'fflate'

/** Entry names only — nothing is decompressed. */
export function zipNames(bytes: Uint8Array): string[] {
  const names: string[] = []
  unzipSync(bytes, { filter: (f) => { names.push(f.name); return false } })
  return names
}

/** Decompress just the named entries. */
export function zipPick(bytes: Uint8Array, wanted: string[]): Record<string, Uint8Array> {
  const set = new Set(wanted)
  return unzipSync(bytes, { filter: (f) => set.has(f.name) })
}
