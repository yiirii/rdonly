// CBR / CB7 support through libarchive (WebAssembly, runs in a worker). Loaded only when needed.
import { comicPages } from '../core/metadata/cbz'
import { mimeFor } from '../core/metadata/util'
import type { PageSource } from './pageSource'

type CompressedFile = { name: string; size: number; extract(): Promise<File> }
type ArchiveT = { getFilesArray(): Promise<{ file: CompressedFile; path: string }[]>; close?(): Promise<void> }

let ready: Promise<{ open(f: File): Promise<ArchiveT> }> | undefined
function lib() {
  return (ready ??= import('libarchive.js').then(({ Archive }) => {
    Archive.init({ workerUrl: `${import.meta.env.BASE_URL}vendor/libarchive/worker-bundle.js` })
    return { open: (f: File) => Archive.open(f) as unknown as Promise<ArchiveT> }
  }))
}

export async function openLibarchive(file: Blob): Promise<PageSource & { comicInfo?: string }> {
  const archive = await (await lib()).open(file instanceof File ? file : new File([file], 'book'))
  const entries = await archive.getFilesArray()
  const byPath = new Map(entries.map((e) => [`${e.path}${e.file.name}`, e.file]))
  const names = comicPages([...byPath.keys()])
  const infoPath = [...byPath.keys()].find((p) => p.split('/').pop()!.toLowerCase() === 'comicinfo.xml')
  const comicInfo = infoPath ? await (await byPath.get(infoPath)!.extract()).text() : undefined
  return {
    count: names.length,
    names,
    comicInfo,
    async page(i) {
      const f = await byPath.get(names[i])!.extract()
      return new Blob([await f.arrayBuffer()], { type: mimeFor(names[i]) })
    },
    close() { void archive.close?.() },
  }
}
