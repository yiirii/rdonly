import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

const startRecording = (page: Page) => page.evaluate(() => {
  const w = window as any
  w.__frames = []
  let last = performance.now()
  const tick = (t: number) => { w.__frames.push(t - last); last = t; if (w.__rec) requestAnimationFrame(tick) }
  w.__rec = true
  requestAnimationFrame(tick)
})
const stopRecording = (page: Page) => page.evaluate(() => { const w = window as any; w.__rec = false; return w.__frames.slice(1) as number[] })
const stats = (f: number[]) => {
  const s = [...f].sort((a, b) => a - b)
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { frames: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) }
}

test('animation frame times on a 4x-slowed phone', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await page.goto('/')
  await expect(page.getByTestId('empty-state')).toBeVisible()
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await startRecording(page)
  await page.getByTestId('import-input').setInputFiles(['novel.epub', 'bare.epub', 'doc.pdf', 'manga.cbz', 'plain.cbz'].map((n) => `tests/fixtures/${n}`))
  await expect(page.getByTestId('book-card')).toHaveCount(5)
  await page.waitForTimeout(900)
  const cards = stats(await stopRecording(page))

  await page.waitForTimeout(4500) // let the toast leave
  await startRecording(page)
  await page.getByTestId('settings-button').click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(700)
  const sheet = stats(await stopRecording(page))

  // Page turns: comic (transform slide) and novel (foliate paginator).
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const turns = async (fixture: string, ready: string) => {
    await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
    await page.getByTestId('book-card').filter({ hasText: fixture === 'long.epub' ? 'The Long Road' : 'plain' }).click()
    await page.locator(ready).first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(1200)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await startRecording(page)
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450) }
    const r = stats(await stopRecording(page))
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await page.keyboard.press('Escape'); await page.waitForTimeout(500)
    return r
  }
  const comicTurn = await turns('plain.cbz', '[data-testid="comic-page"] img')
  const novelTurn = await turns('long.epub', '[data-testid="novel"][data-cfi]')

  const result = { version: process.env.npm_package_version ?? 'dev', cpuThrottle: 4, viewport: '390x844', cardsEnter: cards, settingsSheet: sheet, comicPageTurn: comicTurn, novelPageTurn: novelTurn }
  mkdirSync('docs/perf', { recursive: true })
  writeFileSync(process.env.PERF_OUT ?? 'test-results/perf.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
  expect(sheet.p95).toBeLessThanOrEqual(24)
  expect(comicTurn.p95).toBeLessThanOrEqual(24)
})
