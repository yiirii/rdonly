import { useRef } from 'react'

export const ACCEPT = '.epub,.pdf,.cbz,.cbr,.cb7,application/epub+zip,application/pdf,application/vnd.comicbook+zip,application/vnd.comicbook-rar,application/x-cb7,application/zip,application/x-rar-compressed,application/x-7z-compressed'

/** Folder picking isn't available on iPhone/iPad. */
export const canPickFolders = () => typeof navigator !== 'undefined' && !/iPhone|iPad|iPod/.test(navigator.userAgent)
  && 'webkitdirectory' in document.createElement('input')

export function ImportButton({ onFiles, onFolder, busy, label = 'Import' }: {
  onFiles: (f: File[]) => void; onFolder?: (f: File[]) => void; busy: boolean; label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const take = (cb: (f: File[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) cb(fs)
  }
  return (
    <>
      {onFolder && canPickFolders() && (
        <button className="keycap ghost" data-testid="import-folder-button" disabled={busy} onClick={() => folder.current?.click()}>Folder</button>
      )}
      <button className="keycap primary" data-testid="import-button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Importing…' : label}
      </button>
      <input ref={input} data-testid="import-input" type="file" multiple accept={ACCEPT} hidden onChange={take(onFiles)} />
      {onFolder && (
        <input ref={folder} data-testid="import-folder-input" type="file" hidden onChange={take(onFolder)}
          {...{ webkitdirectory: '', directory: '' }} />
      )}
    </>
  )
}
