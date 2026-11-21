import { test, expect, type Page } from '@playwright/test'

// Count blob: URLs created minus revoked (ignores data: URLs).
const tracker = () => {
  const live = new Set<string>()
  const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL)
  URL.createObjectURL = (o: Blob | MediaSource) => { const u = c(o); live.add(u); return u }
  URL.revokeObjectURL = (u: string) => { live.delete(u); r(u) }
  ;(window as any).__liveUrls = () => live.size
}
const live = (page: Page) => page.evaluate(() => (window as any).__liveUrls())

for (const [fixture, ready] of [['long.epub', '[data-testid="novel"][data-cfi]'], ['plain.cbz', '[data-testid="comic-page"] img'], ['webtoon.cbz', '[data-testid="webtoon-page"] img']] as const) {
  test(`closing ${fixture} lets go of everything it loaded`, async ({ page }) => {
    await page.addInitScript(tracker)
    await page.goto('/')
    await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
    await expect(page.getByTestId('book-card')).toHaveCount(1)
    const before = await live(page)
    await page.getByTestId('book-card').click()
    await page.locator(ready).first().waitFor({ timeout: 15000 })
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('reader')).toHaveCount(0)
    await page.waitForTimeout(800)
    expect(await live(page)).toBe(before)
  })
}

test('closing a comic straight after opening leaks nothing', async ({ page }) => {
  await page.addInitScript(tracker)
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/webtoon.cbz'])
  await expect(page.getByTestId('book-card')).toHaveCount(1)
  const before = await live(page)
  await page.getByTestId('book-card').click()
  await page.getByTestId('reader').waitFor()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)
  expect(await live(page)).toBe(before)
})
