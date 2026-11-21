// pdf.js, loaded lazily, reading the file in ranges straight from the Blob (no full copy in memory).
type PdfJs = typeof import('pdfjs-dist')
let lib: Promise<PdfJs> | undefined
export function pdfjs(): Promise<PdfJs> {
  return (lib ??= (async () => {
    const m = await import('pdfjs-dist')
    m.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    return m
  })())
}

export async function openPdf(file: Blob) {
  const m = await pdfjs()
  class BlobRange extends m.PDFDataRangeTransport {
    constructor(private blob: Blob) { super(blob.size, new Uint8Array(0)) }
    requestDataRange(begin: number, end: number) {
      void this.blob.slice(begin, end).arrayBuffer().then((b) => this.onDataRange(begin, new Uint8Array(b)))
    }
  }
  const task = m.getDocument({ range: new BlobRange(file), disableAutoFetch: true, disableStream: true, rangeChunkSize: 256 * 1024 })
  return { task, doc: await task.promise }
}
