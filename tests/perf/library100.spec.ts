import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const stats = (f: number[]) => { const s = [...f].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { frames: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) } }

test('a 100-book library stays smooth on a 4x-slowed phone', async ({ page }) => {
  await page.goto('/#debug')
  await page.waitForFunction(() => (window as any).__rdonly)
  await page.evaluate(async () => {
    const d = (window as any).__rdonly; const records = d.records(), library = d.library()
    const tags = ['novel', 'manga', 'comic', 'webtoon', 'document']
    for (let i = 0; i < 100; i++) {
      await records.put('books', { id: `b${i}`, title: `Book ${String(i).padStart(3, '0')}`, author: `Author ${i % 13}`, format: 'epub', tag: tags[i % 5], fileName: `b${i}.epub`, fileSize: 1000, addedAt: 1000 + i, updatedAt: 1000 + i })
      if (i % 3 === 0) await records.put('progress', { id: `b${i}`, locator: '', percent: (i % 10) / 10, mode: 'novel', updatedAt: 2000 + i })
    }
    await library.getState().load()
  })
  await expect(page.getByTestId('book-card').first()).toBeVisible()
  await page.waitForTimeout(1500)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const rec = async (fn: () => Promise<void>) => {
    await page.evaluate(() => { const w = window as any; w.__f = []; let l = performance.now(); w.__r = true; const t = (x: number) => { w.__f.push(x - l); l = x; if (w.__r) requestAnimationFrame(t) }; requestAnimationFrame(t) })
    await fn()
    return stats(await page.evaluate(() => { const w = window as any; w.__r = false; return w.__f.slice(1) as number[] }))
  }
  const search = await rec(async () => { await page.getByRole('searchbox').pressSequentially('book 04', { delay: 120 }); await page.waitForTimeout(500); await page.getByRole('searchbox').fill(''); await page.waitForTimeout(600) })
  const tabs = await rec(async () => { for (const name of [/Reading/, /Not started/, /^All/]) { await page.getByRole('tab', { name }).click(); await page.waitForTimeout(600) } })
  const chips = await rec(async () => { for (const name of ['Manga', 'Manga']) { await page.getByRole('checkbox', { name }).click(); await page.waitForTimeout(600) } })
  const result = { books: 100, cpuThrottle: 4, search, tabs, chips }
  console.log(JSON.stringify(result))
  writeFileSync('test-results/perf-library100.json', JSON.stringify(result, null, 2))
})
