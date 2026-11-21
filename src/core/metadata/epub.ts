import { strFromU8 } from 'fflate'
import { zipPick } from './zip'
import type { BookMeta } from './types'
import { blobOf, byLocal, clean, mimeFor, num, xml } from './util'

const resolve = (base: string, href: string) => {
  const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').concat(decodeURIComponent(href)).split('/')
  const out: string[] = []
  for (const p of parts) p === '..' ? out.pop() : p !== '.' && out.push(p)
  return out.join('/')
}

export function epubMeta(bytes: Uint8Array): BookMeta {
  const container = zipPick(bytes, ['META-INF/container.xml'])['META-INF/container.xml']
  if (!container) throw new Error('Not a valid EPUB (no container.xml)')
  const opfPath = byLocal(xml(strFromU8(container)), 'rootfile')[0]?.getAttribute('full-path')
  const opfBytes = opfPath ? zipPick(bytes, [opfPath])[opfPath] : undefined
  if (!opfPath || !opfBytes) throw new Error('Not a valid EPUB (no package file)')
  const opf = xml(strFromU8(opfBytes))
  const metas = byLocal(opf, 'meta')

  const meta: BookMeta = {
    title: clean(byLocal(opf, 'title')[0]?.textContent),
    author: clean(byLocal(opf, 'creator')[0]?.textContent),
  }
  const coll = metas.find((m) => m.getAttribute('property') === 'belongs-to-collection')
  const calibreSeries = metas.find((m) => m.getAttribute('name') === 'calibre:series')
  if (coll) {
    meta.series = clean(coll.textContent)
    const id = coll.getAttribute('id')
    meta.volume = num(metas.find((m) => m.getAttribute('refines') === `#${id}` && m.getAttribute('property') === 'group-position')?.textContent)
  } else if (calibreSeries) {
    meta.series = clean(calibreSeries.getAttribute('content'))
    meta.volume = num(metas.find((m) => m.getAttribute('name') === 'calibre:series_index')?.getAttribute('content'))
  }

  const items = byLocal(opf, 'item')
  const coverId = metas.find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content')
  const coverItem = items.find((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('cover-image'))
    ?? items.find((i) => coverId && i.getAttribute('id') === coverId && (i.getAttribute('media-type') ?? '').startsWith('image/'))
  const href = coverItem?.getAttribute('href')
  if (href) {
    const path = resolve(opfPath, href)
    const data = zipPick(bytes, [path])[path]
    if (data) meta.cover = blobOf(data, coverItem!.getAttribute('media-type') ?? mimeFor(path))
  }
  return meta
}
