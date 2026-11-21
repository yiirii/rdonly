import { test, expect, type Page } from '@playwright/test'

async function open(page: Page, fixture: string) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('comic')).toBeVisible()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
}
const tap = async (page: Page, third: 'left' | 'middle' | 'right') => {
  const vp = page.viewportSize()!
  const x = third === 'left' ? vp.width * 0.12 : third === 'right' ? vp.width * 0.88 : vp.width / 2
  await page.mouse.click(x, vp.height / 2)
  await page.waitForTimeout(350)
}
const label = (page: Page) => page.getByTestId('reader-progress')
const shown = (page: Page) => page.locator('[data-testid="comic-spread"][data-current="true"] [data-testid="comic-page"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-page'))))

test('manga reads right to left on the phone', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await open(page, 'manga.cbz')
  expect(await shown(page)).toEqual([0])
  await tap(page, 'left')
  expect(await shown(page)).toEqual([1])
  await tap(page, 'right')
  expect(await shown(page)).toEqual([0])
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(350)
  expect(await shown(page)).toEqual([1])
  await page.screenshot({ path: 'test-results/shots/manga-phone.png' })
})

test('comics read left to right', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await open(page, 'plain.cbz')
  await tap(page, 'right')
  expect(await shown(page)).toEqual([1])
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350)
  expect(await shown(page)).toEqual([2])
})

test('laptop shows two pages side by side, manga order right to left', async ({ page }) => {
  test.skip(test.info().project.name !== 'laptop')
  await open(page, 'manga.cbz')
  expect(await shown(page)).toEqual([0]) // cover alone
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(350)
  expect(await shown(page)).toEqual([1, 2])
  const x = async (n: number) => (await page.locator(`[data-testid="comic-spread"][data-current="true"] [data-page="${n}"]`).boundingBox())!.x
  expect(await x(2)).toBeLessThan(await x(1))
  await expect(label(page)).toContainText('3')
  await page.screenshot({ path: 'test-results/shots/manga-laptop-spread.png' })
})

test('reopening returns to the same page', async ({ page }) => {
  await open(page, 'plain.cbz')
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350)
  const before = await shown(page)
  await page.getByTestId('reader').click({ position: { x: page.viewportSize()!.width / 2, y: page.viewportSize()!.height / 2 } })
  await page.getByTestId('reader-back').click()
  await expect(page.getByTestId('reader')).toHaveCount(0)
  await page.getByTestId('book-card').click()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  expect(await shown(page)).toEqual(before)
})

test('a damaged page shows a tile and the book still reads past it', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await open(page, 'damaged-page.cbz')
  await tap(page, 'right')
  await expect(page.locator('[data-testid="comic-spread"][data-current="true"] [data-testid="page-error"]')).toBeVisible()
  await tap(page, 'right')
  expect(await shown(page)).toEqual([2])
  await expect(page.locator('[data-testid="comic-spread"][data-current="true"] img')).toBeVisible()
})

test('tapping the middle shows and hides the bars', async ({ page }) => {
  await open(page, 'plain.cbz')
  await page.waitForTimeout(3300) // bars auto-hide
  await expect(page.getByTestId('reader-back')).toHaveCount(0)
  await tap(page, 'middle')
  await expect(page.getByTestId('reader-back')).toBeVisible()
})
