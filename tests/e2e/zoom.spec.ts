import { test, expect, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/plain.cbz'])
  await page.getByTestId('book-card').click()
  await expect(page.locator('[data-testid="comic-page"] img').first()).toBeVisible()
  await page.waitForTimeout(700)
}
const scale = (page: Page) => page.getByTestId('comic-zoom').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
const shown = (page: Page) => page.locator('[data-testid="comic-spread"][data-current="true"] [data-testid="comic-page"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-page'))))
const center = (page: Page) => ({ x: page.viewportSize()!.width / 2, y: page.viewportSize()!.height / 2 })

test('double-tap zooms in and double-tap again zooms back out', async ({ page }) => {
  await open(page)
  const c = center(page)
  await page.mouse.dblclick(c.x, c.y)
  await page.waitForTimeout(450)
  expect(await scale(page)).toBeCloseTo(2.5, 1)
  await page.mouse.dblclick(c.x, c.y)
  await page.waitForTimeout(450)
  expect(await scale(page)).toBeCloseTo(1, 2)
})

test('while zoomed, a sideways drag pans instead of turning the page', async ({ page }) => {
  await open(page)
  const c = center(page)
  await page.mouse.dblclick(c.x, c.y)
  await page.waitForTimeout(450)
  await page.mouse.move(c.x, c.y); await page.mouse.down()
  await page.mouse.move(c.x - 120, c.y, { steps: 6 }); await page.mouse.up()
  await page.waitForTimeout(400)
  expect(await shown(page)).toEqual([0])
  expect(await scale(page)).toBeCloseTo(2.5, 1)
})

test('Ctrl + wheel zooms on the laptop', async ({ page }) => {
  test.skip(test.info().project.name !== 'laptop')
  await open(page)
  const c = center(page)
  await page.mouse.move(c.x, c.y)
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -300); await page.keyboard.up('Control')
  await page.waitForTimeout(300)
  expect(await scale(page)).toBeGreaterThan(1.5)
  expect(await shown(page)).toEqual([0])
})

test('turning the page resets zoom', async ({ page }) => {
  await open(page)
  const c = center(page)
  await page.mouse.dblclick(c.x, c.y); await page.waitForTimeout(450)
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450)
  expect((await shown(page))[0]).toBe(1) // phone: [1]; laptop spread: [1, 2]
  expect(await scale(page)).toBeCloseTo(1, 2)
})
