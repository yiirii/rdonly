import { test, expect, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/webtoon.cbz'])
  await expect(page.getByTestId('book-card')).toContainText('Webtoon')
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('webtoon')).toBeVisible()
  await expect(page.locator('[data-testid="webtoon-page"] img').first()).toBeVisible()
  await page.waitForTimeout(600)
}
const loaded = (page: Page) => page.locator('[data-testid="webtoon-page"] img[src]').count()

test('imports as a webtoon and reads as one continuous strip', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('webtoon-page')).toHaveCount(12)
  const gaps = await page.getByTestId('webtoon-page').evaluateAll((els) =>
    els.slice(0, 3).map((el, i, a) => (i ? el.getBoundingClientRect().top - a[i - 1].getBoundingClientRect().bottom : 0)))
  expect(gaps.every((g) => Math.abs(g) < 1)).toBe(true)
  await page.screenshot({ path: `test-results/shots/webtoon-${test.info().project.name}.png` })
})

test('only pages near the screen are kept in memory', async ({ page }) => {
  await open(page)
  expect(await loaded(page)).toBeLessThanOrEqual(6)
  await page.getByTestId('webtoon').evaluate((el) => { el.scrollTop = el.scrollHeight })
  await page.waitForTimeout(800)
  expect(await loaded(page)).toBeLessThanOrEqual(6)
  await expect(page.locator('[data-testid="webtoon-page"][data-page="11"] img[src]')).toBeVisible()
})

test('reopening returns to the same spot', async ({ page }) => {
  await open(page)
  await page.getByTestId('webtoon').evaluate((el) => {
    const p = el.querySelector('[data-page="6"]') as HTMLElement
    el.scrollTop = p.offsetTop + p.offsetHeight / 2
  })
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('reader')).toHaveCount(0)
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('webtoon')).toBeVisible()
  await page.waitForTimeout(900)
  const at = await page.getByTestId('webtoon').evaluate((el) => {
    const mid = el.getBoundingClientRect().top + 1
    const pages = [...el.querySelectorAll('[data-testid="webtoon-page"]')] as HTMLElement[]
    return Number(pages.find((p) => p.getBoundingClientRect().bottom > mid)?.dataset.page)
  })
  expect(at).toBe(6)
})
