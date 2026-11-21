import { useRef } from 'react'

export const ACCEPT = '.epub,.pdf,.cbz,application/epub+zip,application/pdf,application/vnd.comicbook+zip,application/zip'

export function ImportButton({ onFiles, busy, label = 'Import' }: { onFiles: (f: File[]) => void; busy: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button className="keycap primary" data-testid="import-button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Importing…' : label}
      </button>
      <input
        ref={input} data-testid="import-input" type="file" multiple accept={ACCEPT} hidden
        onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) onFiles(fs) }}
      />
    </>
  )
}
