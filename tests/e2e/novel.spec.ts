import { test, expect, type Page, type Frame } from '@playwright/test'

async function open(page: Page, fixture = 'long.epub') {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles([`tests/fixtures/${fixture}`])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await page.waitForTimeout(500)
}
const cfi = (page: Page) => page.getByTestId('novel').getAttribute('data-cfi')
const bookFrame = (page: Page): Frame => page.frames().find((f) => f.url().startsWith('blob:'))!
const vp = (page: Page) => page.viewportSize()!
/** Bars show on open and hide after 3 s; tap the middle only if they're gone. */
async function showBars(page: Page) {
  if (await page.getByTestId('reader-back').count() === 0) await page.mouse.click(vp(page).width / 2, vp(page).height / 2)
  await expect(page.getByTestId('reader-back')).toBeVisible()
}

test('a novel opens paginated and the right third turns the page', async ({ page }) => {
  await open(page)
  const first = await cfi(page)
  await page.mouse.click(vp(page).width * 0.9, vp(page).height / 2)
  await expect.poll(() => cfi(page)).not.toBe(first)
  await page.screenshot({ path: `test-results/shots/novel-paper-${test.info().project.name}.png` })
})

test('arrow keys turn pages', async ({ page }) => {
  await open(page)
  const first = await cfi(page)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => cfi(page)).not.toBe(first)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => cfi(page)).toBe(first)
})

test('the Aa sheet changes theme and text size', async ({ page }) => {
  await open(page)
  await showBars(page)
  await page.getByTestId('reading-settings-button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const sizeBefore = await bookFrame(page).evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))
  for (const id of ['sepia', 'night', 'oled', 'paper', 'night']) {
    await page.getByTestId(`theme-${id}`).click()
    if (id === 'night' || id === 'paper') await page.screenshot({ path: `test-results/shots/novel-sheet-${id}-${test.info().project.name}.png` })
  }
  await expect.poll(() => bookFrame(page).evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(28, 29, 33)')
  await page.getByTestId('font-size-up').click()
  await page.getByTestId('font-size-up').click()
  await expect.poll(() => bookFrame(page).evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThan(sizeBefore)
  await page.getByTestId('font-vollkorn').click()
  await expect.poll(() => bookFrame(page).evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Vollkorn')
})

test('reopening returns to the same place', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400) }
  const at = await cfi(page)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('reader')).toHaveCount(0)
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await expect.poll(() => cfi(page)).toBe(at)
})

test('the bottom bar shows the chapter and the slider jumps', async ({ page }) => {
  await open(page)
  await showBars(page)
  await expect(page.getByTestId('reader-progress')).toContainText('Chapter 1')
  await page.getByTestId('novel-scrubber').fill('0.7')
  await expect(page.getByTestId('reader-progress')).toContainText('Chapter 3', { timeout: 10000 })
})

test('a fixed-layout book opens as pages', async ({ page }) => {
  await open(page, 'fixed.epub')
  await expect(page.getByTestId('novel')).toHaveAttribute('data-layout', 'fixed')
})

test('Escape closes the book even after clicking into the page', async ({ page }) => {
  test.skip(test.info().project.name !== 'laptop')
  await open(page)
  const f = bookFrame(page)
  await f.locator('body').click({ position: { x: 300, y: 300 } })
  await page.waitForTimeout(300)
  await f.locator('body').press('Escape')
  await expect(page.getByTestId('reader')).toHaveCount(0)
})

test('page turns glide (slide + fade) instead of scrolling', async ({ page }) => {
  await open(page)
  const host = page.locator('.novel-host')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(60)
  const mid = await host.evaluate((el) => ({ o: Number(getComputedStyle(el).opacity), t: getComputedStyle(el).transform }))
  expect(mid.o).toBeLessThan(1)
  expect(mid.t).not.toBe('none')
  await page.waitForTimeout(600)
  const rest = await host.evaluate((el) => ({ o: getComputedStyle(el).opacity, t: getComputedStyle(el).transform }))
  expect(rest).toEqual({ o: '1', t: 'none' })
  const animated = await page.evaluate(() => {
    const v = document.querySelector('foliate-view') as any
    return v?.renderer?.hasAttribute('animated')
  })
  expect(animated).toBe(false)
})

test('holding the arrow key never leaves a half-faded page', async ({ page }) => {
  await open(page)
  const first = await cfi(page)
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight', { delay: 20 })
  await page.waitForTimeout(900)
  const rest = await page.locator('.novel-host').evaluate((el) => ({ o: getComputedStyle(el).opacity, t: getComputedStyle(el).transform }))
  expect(rest).toEqual({ o: '1', t: 'none' })
  expect(await cfi(page)).not.toBe(first)
})

const hostMotion = (page: Page) => page.locator('.novel-host').evaluate((el) => ({ o: Number(getComputedStyle(el).opacity), x: new DOMMatrix(getComputedStyle(el).transform).e }))

test('the glide follows the side you pressed, even in right-to-left books', async ({ page }) => {
  await open(page, 'rtl.epub')
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(60)
  expect((await hostMotion(page)).x).toBeGreaterThan(0) // old page leaves to the right
})

test('on the phone a tap turns the page quickly (no hidden scroll animation)', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await open(page)
  const vp = page.viewportSize()!
  await page.touchscreen.tap(vp.width * 0.9, vp.height / 2)
  await page.waitForTimeout(380)
  expect((await hostMotion(page)).o).toBeGreaterThan(0.85)
})

test('on the phone, tapping near the top or bottom of a novel does not bring the bars up', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone')
  await open(page)
  await expect(page.getByTestId('reader-back')).toHaveCount(0, { timeout: 6000 })
  await page.touchscreen.tap(40, 800)
  await page.waitForTimeout(500)
  await expect(page.getByTestId('reader-back')).toHaveCount(0)
})
