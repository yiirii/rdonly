export function titleFromFileName(name: string): string {
  return name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim()
}
