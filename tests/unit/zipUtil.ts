/** Corrupt the compressed data of one zip entry (by name). */
export function corruptEntry(bytes: Uint8Array, name: string): Uint8Array {
  const out = bytes.slice()
  const nameBytes = new TextEncoder().encode(name)
  for (let i = 0; i < out.length - 30; i++) {
    if (out[i] === 0x50 && out[i + 1] === 0x4b && out[i + 2] === 3 && out[i + 3] === 4) {
      const nlen = out[i + 26] | (out[i + 27] << 8), xlen = out[i + 28] | (out[i + 29] << 8)
      const entry = out.slice(i + 30, i + 30 + nlen)
      if (entry.length === nameBytes.length && entry.every((b, k) => b === nameBytes[k])) {
        const data = i + 30 + nlen + xlen
        for (let k = 0; k < 8; k++) out[data + k] = 0xff
        return out
      }
    }
  }
  throw new Error(`entry ${name} not found`)
}
