import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const b64 = (name: string) => readFileSync(`tests/fixtures/${name}`).toString('base64')

test.beforeEach(async ({ page }) => {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
})

test('reads PDF title and renders page 1 as cover', async ({ page }) => {
  const r = await page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    const m = await (window as any).__rdonly.extractMeta('pdf', bytes)
    return { title: m.title, author: m.author, coverSize: m.cover?.size ?? 0 }
  }, b64('doc.pdf'))
  expect(r.title).toBe('Test Doc')
  expect(r.author).toBe('P. Author')
  expect(r.coverSize).toBeGreaterThan(100)
})

test('makes a small WebP-or-JPEG thumbnail no wider than 300px', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1800
    const g = c.getContext('2d')!
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 37 % 360} 60% 50%)`; g.fillRect((i * 97) % 1200, (i * 53) % 1800, 90, 90) }
    const big = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'))
    const t: Blob = await (window as any).__rdonly.makeThumb(big)
    const bmp = await createImageBitmap(t)
    return { size: t.size, type: t.type, w: bmp.width, h: bmp.height }
  })
  expect(r.size).toBeLessThanOrEqual(40_000)
  expect(['image/webp', 'image/jpeg']).toContain(r.type)
  expect(r.w).toBeLessThanOrEqual(300)
  expect(r.h).toBe(450)
})
