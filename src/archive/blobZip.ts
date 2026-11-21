import { inflateSync } from 'fflate'

export interface ZipEntry { name: string; offset: number; compressedSize: number; size: number; method: number }

const read = async (b: Blob, a: number, z: number) => new DataView(await b.slice(a, z).arrayBuffer())
const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true))

/** Read a ZIP's central directory using only the tail of the file (ZIP64 aware). */
export async function readZipIndex(blob: Blob): Promise<ZipEntry[]> {
  const tailLen = Math.min(blob.size, 65_557 + 20)
  const tailStart = blob.size - tailLen
  const tail = await read(blob, tailStart, blob.size)
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('Not a zip archive')
  let count = tail.getUint16(eocd + 10, true)
  let cdSize = tail.getUint32(eocd + 12, true)
  let cdOffset = tail.getUint32(eocd + 16, true)
  if (eocd >= 20 && tail.getUint32(eocd - 20, true) === 0x07064b50) {
    const rec = u64(tail, eocd - 20 + 8)
    const z = await read(blob, rec, rec + 56)
    if (z.getUint32(0, true) !== 0x06064b50) throw new Error('Damaged ZIP64 directory')
    count = u64(z, 32); cdSize = u64(z, 40); cdOffset = u64(z, 48)
  }
  const cd = await read(blob, cdOffset, cdOffset + cdSize)
  const dec = new TextDecoder()
  const out: ZipEntry[] = []
  let p = 0
  for (let n = 0; n < count; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged zip directory')
    const method = cd.getUint16(p + 10, true)
    let compressedSize = cd.getUint32(p + 20, true)
    let size = cd.getUint32(p + 24, true)
    const nameLen = cd.getUint16(p + 28, true), extraLen = cd.getUint16(p + 30, true), commentLen = cd.getUint16(p + 32, true)
    let offset = cd.getUint32(p + 42, true)
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen))
    // ZIP64 extra field carries whichever values overflowed, in this order.
    let e = p + 46 + nameLen
    const end = e + extraLen
    while (e + 4 <= end) {
      const id = cd.getUint16(e, true), len = cd.getUint16(e + 2, true)
      if (id === 0x0001) {
        let q = e + 4
        if (size === 0xffffffff) { size = u64(cd, q); q += 8 }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cd, q); q += 8 }
        if (offset === 0xffffffff) { offset = u64(cd, q) }
      }
      e += 4 + len
    }
    if (!name.endsWith('/')) out.push({ name, offset, compressedSize, size, method })
    p = end + commentLen
  }
  return out
}

/** Read and decompress one entry, touching only its bytes. */
export async function readZipEntry(blob: Blob, e: ZipEntry): Promise<Uint8Array> {
  const h = await read(blob, e.offset, e.offset + 30)
  if (h.getUint32(0, true) !== 0x04034b50) throw new Error(`Damaged entry ${e.name}`)
  const start = e.offset + 30 + h.getUint16(26, true) + h.getUint16(28, true)
  const data = new Uint8Array(await blob.slice(start, start + e.compressedSize).arrayBuffer())
  if (e.method === 0) return data
  if (e.method !== 8) throw new Error(`Unsupported compression in ${e.name}`)
  const out = inflateSync(data, { out: new Uint8Array(e.size) })
  if (out.length !== e.size) throw new Error(`Damaged entry ${e.name}`)
  return out
}
