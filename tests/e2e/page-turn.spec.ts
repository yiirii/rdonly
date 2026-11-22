import { test, expect, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles(['tests/fixtures/long.epub'])
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await page.waitForTimeout(400)
}
async function choose(page: Page, style: 'Glide' | 'Fold' | 'Scroll') {
  if (await page.getByTestId('reading-settings-button').count() === 0) await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2)
  await page.getByTestId('reading-settings-button').click()
  await page.getByRole('radio', { name: style }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
const cfi = (page: Page) => page.getByTestId('novel').getAttribute('data-cfi')

test('Fold: a flat page sweeps across, then is gone', async ({ page }) => {
  await open(page)
  await choose(page, 'Fold')
  const first = await cfi(page)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(90)
  const fold = page.getByTestId('fold-overlay')
  await expect(fold).toHaveCount(1)
  expect(await fold.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none')
  await page.waitForTimeout(800)
  await expect(fold).toHaveCount(0)
  expect(await cfi(page)).not.toBe(first)
})

test('Fold: rapid turns leave nothing behind', async ({ page }) => {
  await open(page)
  await choose(page, 'Fold')
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight', { delay: 25 })
  await page.waitForTimeout(1200)
  await expect(page.getByTestId('fold-overlay')).toHaveCount(0)
  expect(await page.locator('.novel-host').evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
})

test('Scroll: the chapter scrolls, and your place is kept', async ({ page }) => {
  await open(page)
  await choose(page, 'Scroll')
  await expect.poll(() => page.evaluate(() => (document.querySelector('foliate-view') as any).renderer.getAttribute('flow'))).toBe('scrolled')
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500)
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500)
  const at = await cfi(page)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('reader')).toHaveCount(0)
  await page.getByTestId('book-card').click()
  await expect(page.getByTestId('novel')).toHaveAttribute('data-cfi', /^epubcfi/, { timeout: 15000 })
  await expect.poll(() => page.evaluate(() => (document.querySelector('foliate-view') as any).renderer.getAttribute('flow'))).toBe('scrolled')
  // Scrolled pages restore to the start of the paragraph you were in (or the next one).
  const spot = (c: string | null) => { const m = c?.match(/^epubcfi\(\/6\/(\d+)!\/4,\/(\d+)/); return m ? [Number(m[1]), Number(m[2])] : [0, 0] }
  await expect.poll(async () => {
    const [ca, pa] = spot(at), [cb, pb] = spot(await cfi(page))
    return ca === cb && Math.abs(pa - pb) <= 2
  }).toBe(true)
})
