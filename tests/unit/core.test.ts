import { describe, it, expect } from 'vitest'
import { sha256Hex } from '../../src/core/hash'
import { detectFormat } from '../../src/core/formats'
import { titleFromFileName } from '../../src/core/title'
import { fixture } from './fixtures'

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc')))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('detectFormat', () => {
  it.each([
    ['novel.epub', 'epub'], ['bare.epub', 'epub'], ['doc.pdf', 'pdf'],
    ['manga.cbz', 'cbz'], ['plain.cbz', 'cbz'],
  ])('%s → %s', (name, fmt) => expect(detectFormat(name, fixture(name))).toBe(fmt))

  it.each(['book.mobi', 'empty.epub'])('%s is unsupported', (name) => {
    expect(detectFormat(name, fixture(name))).toBeNull()
  })
  it('trusts bytes over the extension', () => {
    expect(detectFormat('renamed.zip', fixture('novel.epub'))).toBe('epub')
    expect(detectFormat('weird.epub', fixture('doc.pdf'))).toBe('pdf')
  })
  it('labels a damaged zip by its extension so import can report it as damaged', () => {
    expect(detectFormat('broken.cbz', fixture('broken.cbz'))).toBe('cbz')
    expect(detectFormat('broken.zip', fixture('broken.cbz'))).toBeNull()
  })
})

describe('titleFromFileName', () => {
  it.each([
    ['One_Piece.v03.cbz', 'One Piece v03'],
    ['My_Book.epub', 'My Book'],
    ['  spaced   name .pdf', 'spaced name'],
    ['noext', 'noext'],
  ])('%s → %s', (input, out) => expect(titleFromFileName(input)).toBe(out))
})
