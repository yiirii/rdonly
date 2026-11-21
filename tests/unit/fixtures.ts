import { readFileSync } from 'node:fs'
export const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/${name}`))
