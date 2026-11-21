import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
})

test('OPFS: a leftover partial file does not count as the book', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('books', { create: true })
    const h = await dir.getFileHandle('abc.cbz.crswap', { create: true })
    const w = await h.createWritable(); await w.write('half'); await w.close()
    const s = (window as any).__rdonly.createOpfsFileStore()
    return { has: await s.has('abc'), get: (await s.get('abc')) === undefined }
  })
  expect(r).toEqual({ has: false, get: true })
})

test('OPFS: a failed write leaves nothing behind', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const s = (window as any).__rdonly.createOpfsFileStore()
    let threw = false
    try { await s.put('def', 'cbz', { type: 'write', position: -1, data: null }) } catch { threw = true }
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('books', { create: true })
    const names: string[] = []
    for await (const [n] of (dir as any).entries()) names.push(n)
    return { threw, has: await s.has('def'), names: names.filter((n) => n.startsWith('def')) }
  })
  expect(r).toEqual({ threw: true, has: false, names: [] })
})

test('OPFS: stores and reads back a book', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const s = (window as any).__rdonly.createOpfsFileStore()
    await s.put('ghi', 'epub', new Uint8Array([7, 8, 9]))
    return { has: await s.has('ghi'), bytes: Array.from(await s.get('ghi')), used: (await s.usage()).usedBytes }
  })
  expect(r.has).toBe(true); expect(r.bytes).toEqual([7, 8, 9]); expect(r.used).toBeGreaterThanOrEqual(3)
})
