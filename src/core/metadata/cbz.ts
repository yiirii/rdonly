import { strFromU8 } from 'fflate'
import { zipNames, zipPick } from './zip'
import { IMAGE_RE } from '../formats'
import type { BookMeta } from './types'
import { blobOf, byLocal, clean, mimeFor, naturalCompare, num, xml } from './util'

export function comicPages(names: string[]): string[] {
  return names.filter((n) => IMAGE_RE.test(n) && !n.startsWith('__MACOSX/') && !n.split('/').pop()!.startsWith('.')).sort(naturalCompare)
}

export function cbzMeta(bytes: Uint8Array): BookMeta {
  const names = zipNames(bytes)
  const infoName = names.find((n) => n.split('/').pop()!.toLowerCase() === 'comicinfo.xml')
  const first = comicPages(names)[0]
  if (!first) throw new Error('No pages found in this comic')
  const files = zipPick(bytes, infoName ? [infoName, first] : [first])
  const meta: BookMeta = {}
  if (infoName) {
    const doc = xml(strFromU8(files[infoName]))
    const get = (t: string) => clean(byLocal(doc, t)[0]?.textContent)
    meta.series = get('Series')
    meta.volume = num(get('Volume') ?? get('Number'))
    meta.author = get('Writer') ?? get('Penciller')
    const t = get('Title')
    if (t && meta.series) meta.title = `${meta.series} ${meta.volume !== undefined ? `Vol. ${meta.volume}` : t}`
    else meta.title = t
    meta.mangaHint = /^yes/i.test(get('Manga') ?? '')
  }
  meta.cover = blobOf(files[first], mimeFor(first))
  return meta
}
