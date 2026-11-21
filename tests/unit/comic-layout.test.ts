import { describe, it, expect } from 'vitest'
import { buildSpreads, spreadFor } from '../../src/reader/comic/layout'

const tall = { w: 600, h: 900 }, wide = { w: 1200, h: 900 }
const sizes = (n: number, overrides: Record<number, { w: number; h: number }> = {}) => Array.from({ length: n }, (_, i) => overrides[i] ?? tall)

describe('buildSpreads', () => {
  it('one page each in single mode', () => {
    expect(buildSpreads(sizes(3), { double: false, coverAlone: true })).toEqual([[0], [1], [2]])
  })
  it('pairs pages after a lone cover in double mode', () => {
    expect(buildSpreads(sizes(6), { double: true, coverAlone: true })).toEqual([[0], [1, 2], [3, 4], [5]])
  })
  it('pairs from the first page when the cover is not alone', () => {
    expect(buildSpreads(sizes(4), { double: true, coverAlone: false })).toEqual([[0, 1], [2, 3]])
  })
  it('a wide page stands alone and restarts pairing', () => {
    expect(buildSpreads(sizes(7, { 3: wide }), { double: true, coverAlone: true })).toEqual([[0], [1, 2], [3], [4, 5], [6]])
  })
  it('unknown sizes count as normal pages', () => {
    expect(buildSpreads([undefined, undefined, undefined], { double: true, coverAlone: true })).toEqual([[0], [1, 2]])
  })
})

describe('spreadFor', () => {
  it('finds the spread that contains a page', () => {
    const s = [[0], [1, 2], [3, 4]]
    expect(spreadFor(s, 0)).toBe(0); expect(spreadFor(s, 2)).toBe(1); expect(spreadFor(s, 4)).toBe(2)
    expect(spreadFor(s, 99)).toBe(2)
  })
})
