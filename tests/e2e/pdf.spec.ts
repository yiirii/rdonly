import { test, expect, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.pdf'])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('pdf')).toBeVisible()
  await expect(page.locator('[data-testid="pdf-page"][data-page="0"] canvas')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(500)
}
const label = (page: Page) => page.getByTestId('reader-progress').textContent()
const scrollToPage = (page: Page, n: number) => page.getByTestId('pdf').evaluate((el, n) => {
  el.scrollTop = (el.querySelector(`[data-page="${n}"]`) as HTMLElement).offsetTop + 10
}, n)

test('opens at page 1 and tracks the page while scrolling', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('reader-progress')).toHaveText('1 / 30')
  await page.screenshot({ path: `test-results/shots/pdf-${test.info().project.name}.png` })
  await scrollToPage(page, 19)
  await expect(page.getByTestId('reader-progress')).toHaveText('20 / 30')
})

test('only pages near the screen are drawn', async ({ page }) => {
  await open(page)
  await scrollToPage(page, 15)
  await page.waitForTimeout(800)
  expect(await page.locator('[data-testid="pdf-page"] canvas').count()).toBeLessThanOrEqual(6)
  await expect(page.locator('[data-testid="pdf-page"][data-page="15"] canvas')).toBeVisible()
})

test('reopening returns to the same page', async ({ page }) => {
  await open(page)
  await scrollToPage(page, 19)
  await expect(page.getByTestId('reader-progress')).toHaveText('20 / 30')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('reader')).toHaveCount(0)
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('pdf')).toBeVisible()
  await expect.poll(() => label(page), { timeout: 10000 }).toBe('20 / 30')
})

test('Ctrl + wheel zooms', async ({ page }) => {
  test.skip(test.info().project.name !== 'laptop')
  await open(page)
  const before = await page.locator('[data-testid="pdf-page"][data-page="0"]').boundingBox()
  await page.mouse.move(700, 400)
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -400); await page.keyboard.up('Control')
  await page.waitForTimeout(400)
  const after = await page.locator('[data-testid="pdf-page"][data-page="0"]').boundingBox()
  expect(after!.width).toBeGreaterThan(before!.width * 1.3)
})

test('zooming in keeps each drawn page within a safe memory size', async ({ page }) => {
  test.skip(test.info().project.name !== 'laptop')
  await open(page)
  await page.mouse.move(700, 400)
  await page.keyboard.down('Control')
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -400)
  await page.keyboard.up('Control')
  await page.waitForTimeout(800)
  expect(Number(await page.getByTestId('pdf').getAttribute('data-zoom'))).toBeGreaterThan(2.5)
  const px = await page.locator('[data-testid="pdf-page"] canvas').evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).width * (c as HTMLCanvasElement).height))
  expect(Math.max(...px)).toBeLessThanOrEqual(5_000_000)
})
