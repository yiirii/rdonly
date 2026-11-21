// Generates small, deterministic test books into tests/fixtures. Run: npx tsx scripts/make-fixtures.ts
import { zipSync, strToU8 } from 'fflate'
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = 'tests/fixtures'
mkdirSync(out, { recursive: true })

/** Solid-colour RGB PNG. */
export function png(w: number, h: number, [r, g, b]: [number, number, number]): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())])
  const raw = Buffer.concat(Array.from({ length: h }, () => row))
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}

const fixed = { mtime: new Date('2026-01-01T00:00:00Z') }
const zip = (files: Record<string, Uint8Array>, storeFirst?: string) => {
  const entries: Record<string, [Uint8Array, { level: 0 | 6; mtime: Date }]> = {}
  if (storeFirst) entries[storeFirst] = [files[storeFirst], { level: 0, ...fixed }]
  for (const [k, v] of Object.entries(files)) if (k !== storeFirst) entries[k] = [v, { level: 6, ...fixed }]
  return zipSync(entries)
}

function epub(opts: { title?: string; author?: string; cover?: boolean; series?: string }) {
  const meta = [
    opts.title ? `<dc:title>${opts.title}</dc:title>` : '',
    opts.author ? `<dc:creator>${opts.author}</dc:creator>` : '',
    '<dc:identifier id="uid">urn:uuid:00000000-0000-0000-0000-000000000001</dc:identifier>',
    opts.series ? `<meta property="belongs-to-collection" id="c1">${opts.series}</meta><meta refines="#c1" property="group-position">2</meta>` : '',
  ].join('')
  const files: Record<string, Uint8Array> = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/content.opf': strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${meta}</metadata><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>${opts.cover ? '<item id="cov" href="images/cover.png" media-type="image/png" properties="cover-image"/>' : ''}</manifest><spine><itemref idref="ch1"/></spine></package>`),
    'OEBPS/ch1.xhtml': strToU8('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>1</title></head><body><p>It was a calm night.</p></body></html>'),
  }
  if (opts.cover) files['OEBPS/images/cover.png'] = png(60, 90, [200, 169, 106])
  return zip(files, 'mimetype')
}

function pdf(title: string): Uint8Array {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>',
    null, // content stream
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Title (${title}) /Author (P. Author) >>`,
  ]
  const stream = '0.78 0.66 0.42 rg 0 0 200 300 re f 0 0 0 rg BT /F1 18 Tf 30 150 Td (Test Doc) Tj ET'
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o ?? `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return strToU8(body)
}

const comicInfo = '<?xml version="1.0"?><ComicInfo><Series>Test Manga</Series><Number>3</Number><Title>Vol 3</Title><Writer>M. Artist</Writer><Manga>YesAndRightToLeft</Manga></ComicInfo>'

writeFileSync(`${out}/novel.epub`, epub({ title: 'Test Novel', author: 'A. Writer', cover: true, series: 'Test Saga' }))
writeFileSync(`${out}/bare.epub`, epub({}))
writeFileSync(`${out}/doc.pdf`, pdf('Test Doc'))
writeFileSync(`${out}/manga.cbz`, zip({
  'ComicInfo.xml': strToU8(comicInfo),
  '1.png': png(60, 90, [224, 108, 117]), '2.png': png(60, 90, [40, 40, 40]), '3.png': png(60, 90, [80, 80, 80]),
}))
writeFileSync(`${out}/plain.cbz`, zip({
  '10.png': png(60, 90, [10, 10, 10]), '2.png': png(60, 90, [20, 20, 20]), '1.png': png(60, 90, [229, 192, 123]),
}))
const full = zip({ '1.png': png(60, 90, [1, 2, 3]), '2.png': png(60, 90, [4, 5, 6]) })
writeFileSync(`${out}/broken.cbz`, full.slice(0, Math.floor(full.length / 2)))
writeFileSync(`${out}/empty.epub`, new Uint8Array())
writeFileSync(`${out}/book.mobi`, strToU8('BOOKMOBI' + '\0'.repeat(64)))
// ZIP64 variant (forced with zip -fz) to exercise the 64-bit central directory path.
{
  const d = mkdtempSync(join(tmpdir(), 'z64-'))
  for (const [n, c] of [['1.png', [10, 120, 200]], ['2.png', [200, 120, 10]]] as const) writeFileSync(join(d, n), png(60, 90, c as [number, number, number]))
  execSync('zip -q -X -fz z64.cbz 1.png 2.png', { cwd: d })
  writeFileSync(`${out}/zip64.cbz`, readFileSync(join(d, 'z64.cbz')))
}
// CBR and CB7 versions of the manga fixture (needs the rar and 7z command-line tools).
{
  const d = mkdtempSync(join(tmpdir(), 'arc-'))
  writeFileSync(join(d, 'ComicInfo.xml'), comicInfo)
  ;([[224, 108, 117], [40, 40, 40], [80, 80, 80]] as const).forEach((c, i) => writeFileSync(join(d, `${i + 1}.png`), png(60, 90, c as unknown as [number, number, number])))
  execSync('rar a -inul -ep -tsm- -tsc- -tsa- manga.cbr ComicInfo.xml 1.png 2.png 3.png', { cwd: d })
  execSync('7z a -bd -bso0 -mtm=off -mtc=off -mta=off manga.cb7 ComicInfo.xml 1.png 2.png 3.png', { cwd: d })
  writeFileSync(`${out}/manga.cbr`, readFileSync(join(d, 'manga.cbr')))
  writeFileSync(`${out}/manga.cb7`, readFileSync(join(d, 'manga.cb7')))
  // a ZIP that was simply renamed to .cbr (common in the wild)
  writeFileSync(`${out}/zip-named.cbr`, readFileSync(`${out}/manga.cbz`))
}
// A folder of loose images, for folder import.
{
  const f = `${out}/folder-comic`
  mkdirSync(f, { recursive: true })
  ;(['10.png', '2.png', '1.png'] as const).forEach((n, i) => writeFileSync(`${f}/${n}`, png(60, 90, [30 * i, 90, 160])))
}
// A comic whose second page is damaged (its compressed bytes are overwritten).
{
  const z = zip({ '1.png': png(60, 90, [90, 160, 90]), '2.png': png(60, 90, [160, 90, 90]), '3.png': png(60, 90, [90, 90, 160]) })
  const name = new TextEncoder().encode('2.png')
  for (let i = 0; i < z.length - 30; i++) {
    if (z[i] === 0x50 && z[i + 1] === 0x4b && z[i + 2] === 3 && z[i + 3] === 4 && name.every((b, k) => z[i + 30 + k] === b)) {
      const data = i + 30 + (z[i + 26] | (z[i + 27] << 8)) + (z[i + 28] | (z[i + 29] << 8))
      for (let k = 0; k < 8; k++) z[data + k] = 0xff
      break
    }
  }
  writeFileSync(`${out}/damaged-page.cbz`, z)
}
// A comic stored without compression (like most real CBZs) whose second page image is corrupt.
{
  const bad = png(60, 90, [160, 90, 90])
  for (let k = 40; k < bad.length - 12; k++) bad[k] = 0x5a // keep the signature, wreck the image data
  writeFileSync(`${out}/stored-damaged.cbz`, zipSync({
    '1.png': [png(60, 90, [90, 160, 90]), { level: 0, mtime: fixed.mtime }],
    '2.png': [bad, { level: 0, mtime: fixed.mtime }],
    '3.png': [png(60, 90, [90, 90, 160]), { level: 0, mtime: fixed.mtime }],
  }))
}
// A webtoon: 12 very tall pages.
writeFileSync(`${out}/webtoon.cbz`, zip(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`${String(i + 1).padStart(2, '0')}.png`, png(60, 400, [20 * i, 140, 200 - 12 * i])]))))
// A long novel: 3 chapters of deterministic generated prose, with a navigation TOC.
{
  const words = 'the river ran past quiet houses where lamps burned late and somebody always kept a kettle warm for travellers who came in from the rain with stories about the hills and the long road north'.split(' ')
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const para = () => { const n = 60 + Math.floor(rnd() * 60); const w = Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return `<p>${w.join(' ')}.</p>` }
  const chapter = (i: number) => strToU8(`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${i}</title></head><body><h1>Chapter ${i}</h1>${Array.from({ length: 30 }, para).join('')}</body></html>`)
  const nav = strToU8('<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Chapter 1</a></li><li><a href="c2.xhtml">Chapter 2</a></li><li><a href="c3.xhtml">Chapter 3</a></li></ol></nav></body></html>')
  const opf = strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>The Long Road</dc:title><dc:creator>R. Walker</dc:creator><dc:language>en</dc:language><dc:identifier id="uid">urn:uuid:00000000-0000-0000-0000-000000000002</dc:identifier><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/><item id="c3" href="c3.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine></package>')
  // Right-to-left copy (e.g. Japanese novels): same text, spine read right to left.
  writeFileSync(`${out}/rtl.epub`, zip({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/content.opf': strToU8(new TextDecoder().decode(opf).replace('<spine>', '<spine page-progression-direction="rtl">').replace('The Long Road', 'Right to Left').replace('-000000000002', '-000000000004')),
    'OEBPS/nav.xhtml': nav, 'OEBPS/c1.xhtml': chapter(1), 'OEBPS/c2.xhtml': chapter(2), 'OEBPS/c3.xhtml': chapter(3),
  }, 'mimetype'))
  writeFileSync(`${out}/long.epub`, zip({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/content.opf': opf, 'OEBPS/nav.xhtml': nav, 'OEBPS/c1.xhtml': chapter(1), 'OEBPS/c2.xhtml': chapter(2), 'OEBPS/c3.xhtml': chapter(3),
  }, 'mimetype'))
}
// A fixed-layout EPUB with two image pages.
{
  const page = (i: number) => strToU8(`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${i}</title><meta name="viewport" content="width=600, height=900"/></head><body style="margin:0"><img src="p${i}.png" style="width:600px;height:900px" alt=""/></body></html>`)
  const opf = strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Picture Book</dc:title><dc:language>en</dc:language><dc:identifier id="uid">urn:uuid:00000000-0000-0000-0000-000000000003</dc:identifier><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta><meta property="rendition:layout">pre-paginated</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/><item id="p2" href="p2.xhtml" media-type="application/xhtml+xml"/><item id="i1" href="p1.png" media-type="image/png"/><item id="i2" href="p2.png" media-type="image/png"/></manifest><spine><itemref idref="p1"/><itemref idref="p2"/></spine></package>')
  const nav = strToU8('<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="p1.xhtml">Start</a></li></ol></nav></body></html>')
  writeFileSync(`${out}/fixed.epub`, zip({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/content.opf': opf, 'OEBPS/nav.xhtml': nav, 'OEBPS/p1.xhtml': page(1), 'OEBPS/p2.xhtml': page(2),
    'OEBPS/p1.png': png(60, 90, [200, 120, 80]), 'OEBPS/p2.png': png(60, 90, [80, 120, 200]),
  }, 'mimetype'))
}
// A 30-page PDF with the page number drawn large on each page.
{
  const n = 30
  const objs: string[] = []
  const add = (o: string) => { objs.push(o); return objs.length }
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>')
  add('PAGES') // placeholder, filled below
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const kids: number[] = []
  for (let i = 1; i <= n; i++) {
    const s = `0.93 0.91 0.86 rg 0 0 420 595 re f 0.15 0.14 0.12 rg BT /F1 72 Tf 150 300 Td (${i}) Tj ET BT /F1 14 Tf 40 540 Td (Long document) Tj ET`
    const content = add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`)
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`))
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${n} >>`
  const info = add('<< /Title (Long Document) /Author (P. Author) >>')
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  body += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  writeFileSync(`${out}/long.pdf`, strToU8(body))
}
console.log('fixtures written')
